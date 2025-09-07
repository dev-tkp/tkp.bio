import { db, storage, FieldValue } from './lib/firebase'; // Firestore의 serverTimestamp를 위해 FieldValue를 가져옵니다.
import axios from 'axios/dist/node/axios.cjs';
import crypto from 'crypto'; // Slack 서명 확인 및 파일 이름 생성을 위해 crypto 모듈 사용

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
    if (event.type === 'message' && !event.subtype && !event.bot_id) {
        try {
            console.log('Processing new message from Slack:', event.text);

            // Slack API를 사용하여 메시지를 보낸 사용자 정보 가져오기
            let authorName = 'tkpar'; // 기본값
            let authorProfilePic = '/assets/profile_pic.png'; // 기본값
            try {
              const userInfoResponse = await axios.get('https://slack.com/api/users.info', {
                  headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` },
                  params: { user: event.user }
              });
              const slackUser = userInfoResponse.data.user;
              authorName = slackUser.profile.display_name || slackUser.real_name || slackUser.name;
              authorProfilePic = slackUser.profile.image_512 || slackUser.profile.image_original || '/assets/profile_pic.png';
            } catch (userError) {
              console.error('Error fetching Slack user info:', userError);
              // 사용자 정보 조회 실패 시 기본값 사용
            }

            const file = event.files && event.files[0];
            let background = {
                type: 'image',
                url: '/assets/post2_bg.gif', // 기본 배경
            };

            // 첨부 파일이 있고, 이미지 또는 비디오인 경우 처리
            if (file && (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'))) {
                console.log(`Processing attached file: ${file.name}`);
                try {
                    // 1. Slack에서 파일 다운로드
                    const response = await axios.get(file.url_private, {
                        headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` },
                        responseType: 'arraybuffer'
                    });
                    
                    // 2. Firebase Storage에 업로드 (storage가 이미 버킷 객체이므로 .bucket() 호출 제거)
                    // 파일 이름의 유일성을 보장하기 위해 UUID 추가
                    const uniqueFileName = `${Date.now()}-${crypto.randomUUID()}-${file.name}`;
                    const destination = `posts/${uniqueFileName}`;
                    const storageFile = storage.file(destination);

                    await storageFile.save(response.data, { metadata: { contentType: file.mimetype } });
                    
                    // 3. 파일을 공개로 설정하고 URL 가져오기
                    await storageFile.makePublic();
                    
                    background = {
                        type: file.mimetype.startsWith('video/') ? 'video' : 'image',
                        url: storageFile.publicUrl(),
                    };
                    console.log(`File successfully uploaded to: ${background.url}`);
                } catch (uploadError) {
                    console.error('Error handling file upload:', uploadError);
                    // 파일 처리 실패 시 기본 배경을 그대로 사용
                }
            }

            const newPost = {
                author: authorName,
                profilePic: authorProfilePic,
                content: event.text || '', // 텍스트가 없는 이미지/비디오만 올릴 경우 대비
                // Firestore의 서버 시간을 사용하면 시간 동기화 및 쿼리에 유리합니다.
                createdAt: FieldValue.serverTimestamp(),
                background: background,
            };

            await db.collection('posts').add(newPost);
            console.log('Successfully added new post to Firestore.');
        } catch (error) {
            console.error('Error saving post to Firestore:', error);
        }
    }
  }
}