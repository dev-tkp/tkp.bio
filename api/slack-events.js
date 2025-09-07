import { db, storage, FieldValue } from './lib/firebase'; // Firestore의 serverTimestamp를 위해 FieldValue를 가져옵니다.
import crypto, { randomUUID } from 'crypto'; // Slack 서명 확인 및 파일 이름 생성을 위해 crypto 모듈 사용

// Vercel의 기본 body-parser를 비활성화합니다. Slack 서명 확인을 위해 원시(raw) 본문이 필요합니다.
export const config = {
  api: {
    bodyParser: false,
  },
};

// 요청 스트림을 버퍼로 읽어오는 헬퍼 함수
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Slack 사용자 정보를 가져오는 헬퍼 함수
async function getSlackUserInfo(userId) {
  try {
    console.log(`[2/8] Attempting to fetch user info for user: ${userId}`);
    const userInfoUrl = new URL('https://slack.com/api/users.info');
    userInfoUrl.searchParams.set('user', userId);

    const userInfoResponse = await fetch(userInfoUrl.toString(), {
      headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` }
    });

    if (!userInfoResponse.ok) {
      throw new Error(`Failed to fetch user info: ${userInfoResponse.status} ${userInfoResponse.statusText}`);
    }

    const userInfoData = await userInfoResponse.json();
    if (!userInfoData.ok) {
      throw new Error(`Slack API error for user info: ${userInfoData.error}`);
    }

    const slackUser = userInfoData.user;
    console.log(`[3/8] Successfully fetched user info for: ${slackUser.profile.display_name || slackUser.real_name}`);
    return {
      authorName: slackUser.profile.display_name || slackUser.real_name || slackUser.name,
      authorProfilePic: slackUser.profile.image_512 || slackUser.profile.image_original || '/assets/profile_pic.png',
    };
  } catch (userError) {
    console.error('[ERROR] Error fetching Slack user info:', userError.message);
    // 사용자 정보 조회 실패 시 기본값 반환
    return {
      authorName: 'tkpar',
      authorProfilePic: '/assets/profile_pic.png',
    };
  }
}

// Slack에서 파일을 다운로드하여 Firebase Storage에 업로드하는 헬퍼 함수
async function uploadFileToFirebase(file, docId) {
  console.log(`[5/8] Attempting to download file from: ${file.url_private_download}`);
  const fileResponse = await fetch(file.url_private_download, {
    headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` }
  });

  if (!fileResponse.ok) {
    throw new Error(`Failed to download file: ${fileResponse.status} ${fileResponse.statusText}`);
  }

  // Cloud Function에서 최적화할 것이므로 원본은 별도 경로에 저장합니다.
  const uniqueFileName = `${Date.now()}-${randomUUID()}-${file.name}`;
  const destination = `posts/originals/${uniqueFileName}`;
  const storageFile = storage.file(destination);

  console.log(`[6/8] Starting to stream file to Firebase Storage at: ${destination}`);

  // 스트림을 Promise로 감싸서 비동기 작업 완료를 기다립니다.
  await new Promise((resolve, reject) => {
    const writeStream = storageFile.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          firestoreDocId: docId // Firestore 문서 ID를 메타데이터에 추가
        }
      },
      public: true, // 업로드와 동시에 파일을 공개로 설정합니다.
    });

    fileResponse.body.pipe(writeStream);

    writeStream.on('finish', () => {
      console.log(`[7/8] File stream finished. File is now public.`);
      resolve();
    });

    writeStream.on('error', (err) => {
      console.error('[ERROR] Firebase Storage stream write error:', err);
      reject(new Error(`Failed to upload file to Firebase Storage: ${err.message}`));
    });
  });

  const publicUrl = storageFile.publicUrl();
  console.log(`[8/8] File successfully uploaded via stream. Public URL: ${publicUrl}`);

  return {
    type: file.mimetype.startsWith('video/') ? 'video' : 'image',
    url: publicUrl,
  };
}

export default async function handler(req, res) {
  const reqBuffer = await buffer(req);
  const rawBody = reqBuffer.toString('utf8');

  // --- Slack 요청 서명 확인 로직 ---
  try {
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    const requestTimestamp = req.headers['x-slack-request-timestamp'];
    const slackSignature = req.headers['x-slack-signature'];

    // 어떤 헤더 또는 환경 변수가 누락되었는지 정확히 확인하기 위한 상세 로깅
    if (!slackSigningSecret) {
      console.error('CRITICAL: SLACK_SIGNING_SECRET environment variable is not set on Vercel.');
      // 서버 설정 오류이므로 500 에러를 반환하는 것이 더 적절합니다.
      return res.status(500).send('Server configuration error.');
    }
    if (!requestTimestamp || !slackSignature) {
        console.warn('Missing Slack signature headers from the request.', {
          hasTimestamp: !!requestTimestamp,
          hasSignature: !!slackSignature,
        });
        return res.status(400).send('Missing Slack signature headers.');
    }

    // 5분 이상 지난 오래된 요청은 거부하여 재전송 공격(replay attack) 방지
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - (60 * 5);
    if (requestTimestamp < fiveMinutesAgo) {
      console.warn('Slack request is too old. Ignoring.');
      return res.status(403).send('Request timestamp is too old.');
    }

    const basestring = `v0:${requestTimestamp}:${rawBody}`;
    const hmac = crypto.createHmac('sha256', slackSigningSecret);
    hmac.update(basestring);
    const mySignature = `v0=${hmac.digest('hex')}`;

    // 타이밍 공격에 안전한 방법으로 서명 비교
    const isVerified = crypto.timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(slackSignature, 'utf8'));

    if (!isVerified) {
      console.warn('Slack signature verification failed.');
      return res.status(403).send('Slack signature verification failed.');
    }
  } catch (error) {
    console.error('Error during Slack signature verification:', error);
    return res.status(500).send('Internal Server Error during verification.');
  }
  // --- 서명 확인 완료 ---

  const body = JSON.parse(rawBody); // 이제 안전하게 본문을 파싱하여 사용합니다.

  // Slack의 URL 인증 요청(challenge)에 응답하기 위한 로직
  if (body && body.type === 'url_verification') {
    // 디버깅을 위해 수신된 이벤트 전체를 로그로 남깁니다.
    console.log('Received Slack event body:', JSON.stringify(body, null, 2));

    console.log('Responding to Slack URL verification challenge.');
    return res.status(200).json({ challenge: body.challenge });
  }

  // Slack에 3초 안에 응답을 보내야 하므로, 일단 성공 응답을 보냅니다.
  // 실제 작업은 이 응답 후에 비동기적으로 처리됩니다.
  res.status(200).send();

  // 실제 이벤트 처리 로직
  if (body.type === 'event_callback') {
    // 디버깅을 위해 수신된 이벤트 전체를 로그로 남깁니다.
    console.log('Received Slack event body:', JSON.stringify(body, null, 2));

    const { event } = body;

    // 봇이 보낸 메시지나, 메시지 수정/삭제 등은 무시하고
    // 순수하게 사용자가 채널에 보낸 새 메시지만 처리합니다.
    if (event.type === 'message' && (!event.subtype || event.subtype === 'file_share') && !event.bot_id) {
        try {
            console.log(`[1/8] Processing new message from Slack: "${event.text}"`);
            const { authorName, authorProfilePic } = await getSlackUserInfo(event.user);

            const file = event.files && event.files[0];

            // Firestore에 먼저 문서를 생성하여 ID를 확보합니다.
            // 배경 정보는 나중에 업데이트합니다.
            const newPost = {
                author: authorName,
                profilePic: authorProfilePic,
                content: event.text || '', // 텍스트가 없는 이미지/비디오만 올릴 경우 대비
                // Firestore의 서버 시간을 사용하면 시간 동기화 및 쿼리에 유리합니다.
                createdAt: FieldValue.serverTimestamp(),
                background: { // 기본 배경으로 먼저 설정
                    type: 'image',
                    url: '/assets/post2_bg.gif',
                },
            };
            
            const postRef = await db.collection('posts').add(newPost);
            console.log(`Created Firestore document with ID: ${postRef.id}`);

            // 파일이 있는 경우, 문서 ID와 함께 업로드 함수를 호출하고 Firestore를 업데이트합니다.
            if (file && (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'))) {
                console.log(`[4/8] File detected. Mimetype: ${file.mimetype}. Processing: ${file.name}`);
                try {
                    const uploadedBackground = await uploadFileToFirebase(file, postRef.id);
                    await postRef.update({ background: uploadedBackground });
                    console.log(`Updated Firestore doc ${postRef.id} with original file URL.`);
                } catch (uploadError) {
                    console.error('[ERROR] Error during file download or upload process:', uploadError.message);
                    // 파일 처리 실패 시 기본 배경을 그대로 사용하므로 추가 작업 없음.
                }
            }
            console.log('Successfully added new post to Firestore.');
        } catch (error) {
            console.error('[ERROR] Error in main post creation logic:', error.stack);
        }
    }
  }
}