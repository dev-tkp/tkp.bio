import { db, storage } from './lib/firebase';
import { FieldValue } from 'firebase-admin/firestore'; // Firestore의 serverTimestamp를 위해 FieldValue를 가져옵니다.
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

  let body;
  try {
    body = JSON.parse(rawBody); // 이제 안전하게 본문을 파싱하여 사용합니다.
  } catch (e) {
    console.error("Failed to parse request body as JSON:", e);
    // Slack은 이 응답을 받지 못할 수 있지만, 서버 로그에는 남습니다.
    return res.status(400).send("Invalid JSON body.");
  }

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
            // Vercel의 짧은 응답 시간 제한을 준수하기 위해, 시간이 오래 걸리는 작업(파일 다운로드, DB 저장 등)을
            // 직접 처리하지 않고 Firestore에 '대기열(queue)' 문서를 생성하여 작업을 위임합니다.
            // 이 문서는 Firebase Cloud Function에 의해 비동기적으로 처리됩니다.
            console.log(`[1/2] Queuing new message from Slack for background processing: "${event.text}"`);
            
            const queueData = {
                slackEvent: event,
                receivedAt: FieldValue.serverTimestamp(), // 작업 추적을 위한 수신 시간
                status: 'pending', // 작업 상태
            };

            // 'post_queue' 컬렉션에 문서를 추가합니다.
            await db.collection('post_queue').add(queueData);
            console.log('[2/2] Successfully queued message in Firestore. Background function will take over.');
        } catch (error) {
            console.error('[ERROR] Failed to queue Slack event in Firestore:', error.stack);
        }
    }

    // :x: (엑스) 이모지 반응으로 포스트를 삭제하는 로직
    // 'x'는 :x: 이모지의 이름입니다.
    if (event.type === 'reaction_added' && event.reaction === 'x') {
      try {
        // 반응이 달린 아이템이 메시지인지 확인
        if (event.item.type !== 'message') {
          return;
        }

        console.log(`[DELETE QUEUE] Queuing delete request for message ts: ${event.item.ts}`);

        const deleteQueueData = {
          slackMessageTs: event.item.ts,
          requestedBy: event.user, // 삭제를 요청한 사용자
          receivedAt: FieldValue.serverTimestamp(),
        };

        await db.collection('delete_queue').add(deleteQueueData);
        console.log('[DELETE QUEUE] Successfully queued delete request in Firestore.');
      } catch (error) {
        console.error('[ERROR] Failed to queue delete request:', error.stack);
      }
    }

    // :x: (엑스) 이모지 반응을 제거하여 포스트를 복원하는 로직
    if (event.type === 'reaction_removed' && event.reaction === 'x') {
      try {
        if (event.item.type !== 'message') {
          return;
        }

        console.log(`[RESTORE] Received restore request for message ts: ${event.item.ts}`);

        const postsRef = db.collection("posts");
        const snapshot = await postsRef.where("slackMessageTs", "==", event.item.ts).limit(1).get();

        if (snapshot.empty) {
          console.warn(`[RESTORE] No post found with slackMessageTs: ${event.item.ts}. Nothing to restore.`);
          return;
        }

        const postDoc = snapshot.docs[0];
        await postDoc.ref.update({
          deleted: false,
          // deletedAt 필드를 삭제하여 복원 상태를 명확히 합니다.
          deletedAt: FieldValue.delete(),
        });

        console.log(`[RESTORE] Successfully restored post: ${postDoc.id}`);
      } catch (error) {
        console.error('[ERROR] Failed to process restore request:', error.stack);
      }
    }
  }
}