import { db, storage } from './lib/firebase';
import axios from 'axios';

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
                    const destination = `posts/${Date.now()}-${file.name}`;
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
                author: 'tkpar',
                profilePic: '/assets/profile_pic.png',
                content: event.text || '', // 텍스트가 없는 이미지/비디오만 올릴 경우 대비
                createdAt: getCurrentTimestamp(),
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