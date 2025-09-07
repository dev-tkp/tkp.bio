export default async function handler(req, res) {
  // Slack의 URL 인증 요청(challenge)에 응답하기 위한 로직
  if (req.body && req.body.type === 'url_verification') {
    console.log('Responding to Slack URL verification challenge.');
    return res.status(200).json({ challenge: req.body.challenge });
  }

  // TODO: 실제 이벤트 처리 로직 추가
  console.log('Received a Slack event:', req.body);


  // Slack에 3초 안에 응답을 보내야 하므로, 일단 성공 응답을 보냅니다.
  res.status(200).send();
}