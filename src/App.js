import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { useLocation } from 'react-router-dom';
import Post from './components/Post.js';

function App() {
  const location = useLocation();
  const appVideosRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // API에서 포스트 데이터 가져오기
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/posts');
        const data = await response.json();
        setPosts(data);
      } catch (error) {
        console.error("Failed to fetch posts:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

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
  }, [location.pathname, posts]); // posts가 로드된 후에 실행되도록 의존성 추가

  if (loading) {
    return <div className="app-loading">Loading posts...</div>;
  }

  return (
    <div className="app">
      <div className="app__videos" ref={appVideosRef}>
        {posts.length > 0 ? (
          posts.map((post) => (
            <Post
              key={post.id}
              {...post}
            />
          ))
        ) : (
          <div className="app-loading">No posts found.</div>
        )}
      </div>
    </div>
  );
}

export default App;