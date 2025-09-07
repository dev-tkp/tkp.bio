// 1. assets 폴더에서 모든 미디어를 이 파일에서 import 합니다.
import post1Bg from '../assets/post1_bg.gif';
import post2Bg from '../assets/post2_bg.gif';
import post3Bg from '../assets/post3_bg.gif';
import post4Bg from '../assets/post4_bg.gif';
import profilePic from '../assets/profile_pic.png';

// 2. 데이터 배열을 정의하고 export 합니다.
const posts = [
  {
    id: 1,
    author: 'tkpar',
    title: '첫 번째 포스트',
    profilePic: profilePic,
    createdAt: '2023-10-26 10:00',
    content: '안녕하세요! 인스타그램 릴스 스타일의 블로그에 오신 것을 환영합니다. 아래로 스크롤하여 다음 포스트를 확인하세요.',
    background: {
      type: 'image', // 'image' 또는 'video'
      url: post1Bg,
    },
  },
  {
    id: 2,
    author: 'tkpar',
    title: 'React와 CSS',
    profilePic: profilePic,
    createdAt: '2023-10-27 10:00',
    // "더보기" 기능을 테스트하기 위해 긴 텍스트로 수정
    content: '이 UI는 React와 CSS의 scroll-snap 기능을 사용하여 구현되었습니다. 텍스트가 길어지면 이렇게 자동으로 줄어들고, "더보기" 버튼이 나타나게 됩니다. 사용자는 이 버튼을 클릭하여 전체 내용을 볼 수 있습니다. 정말 멋지지 않나요?',
    background: {
      type: 'image',
      url: post2Bg,
    },
  },
  {
    id: 3,
    author: 'tkpar',
    title: '세 번째 이야기',
    profilePic: profilePic,
    createdAt: '2023-10-28 10:00',
    content: '여기는 세 번째 포스트의 내용입니다. 모바일 환경에서도 멋진 경험을 제공합니다.',
    background: {
      type: 'image',
      url: post3Bg,
    },
  },
  {
    id: 4,
    author: 'tkpar',
    title: '마지막 포스트',
    profilePic: profilePic,
    createdAt: '2023-10-29 10:00',
    content: '스크롤을 통해 콘텐츠를 소비하는 새로운 방식을 탐색해보세요. 읽어주셔서 감사합니다!',
    background: {
      type: 'image',
      url: post4Bg,
    },
  },
];

export default posts;