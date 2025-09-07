import React, { useEffect, useRef } from 'react';
import './App.css';
import { useLocation } from 'react-router-dom';
import Post from './components/Post';
import posts from './posts';

function App() {
  const location = useLocation();
  const appVideosRef = useRef(null);

  // 앱 로드 시 URL에 포스트 ID가 있으면 해당 포스트로 스크롤
  useEffect(() => {
    const postId = location.pathname.split('/post/')[1];
    if (postId) {
      const postElement = document.getElementById(`post-${postId}`);
      if (postElement && appVideosRef.current) {
        // 렌더링 후 정확한 위치 계산을 위해 setTimeout 사용
        setTimeout(() => {
          appVideosRef.current.scrollTo({
            top: postElement.offsetTop,
            behavior: 'auto', // 페이지 로드 시에는 즉시 이동
          });
        }, 0);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <div className="app__videos" ref={appVideosRef}>
        {posts.map((post) => (
          <Post
            key={post.id}
            {...post}
          />
        ))}
      </div>
    </div>
  );
}

export default App;