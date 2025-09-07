import { db } from './lib/firebase';

// 현재 시간을 'YYYY-MM-DD HH:MM' 형식으로 반환하는 헬퍼 함수
const getCurrentTimestamp = () => {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default async function handler(req, res) {
  // Slack의 URL 인증 요청(challenge)에 응답하기 위한 로직
  if (req.body && req.body.type === 'url_verification') {
    console.log('Responding to Slack URL verification challenge.');
    return res.status(200).json({ challenge: req.body.challenge });
  }
  
  // Slack에 3초 안에 응답을 보내야 하므로, 일단 성공 응답을 보냅니다.
  // 실제 작업은 이 응답 후에 비동기적으로 처리됩니다.
  res.status(200).send();

  // 실제 이벤트 처리 로직
  if (req.body.type === 'event_callback') {
    const { event } = req.body;

    // 봇이 보낸 메시지나, 메시지 수정/삭제 등은 무시하고
    // 순수하게 사용자가 채널에 보낸 새 메시지만 처리합니다.
    if (event.type === 'message' && !event.subtype && !event.bot_id) {
      try {
        console.log('Processing new message from Slack:', event.text);

        // Firestore에 저장할 새 포스트 객체를 생성합니다.
        const newPost = {
          author: 'Taekang Park', // TODO: 향후 Slack 프로필과 연동 가능
          profilePic: '/assets/profile_pic.png', // 기본 프로필 이미지
          content: event.text, // Slack 메시지 내용을 content로 사용
          createdAt: getCurrentTimestamp(),
          background: {
            type: 'image',
            // TODO: 지금은 기본 배경 이미지를 사용합니다.
            // 다음 단계에서 Slack에 첨부된 이미지/비디오를 사용하도록 개선합니다.
            url: '/assets/post2_bg.gif', 
          },
        };

        await db.collection('posts').add(newPost);
        console.log('Successfully added new post to Firestore.');
      } catch (error) {
        console.error('Error saving post to Firestore:', error);
      }
    }
  }
}