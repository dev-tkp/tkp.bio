import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import { useLocation } from 'react-router-dom';
import Post from './components/Post';

function App() {
  const location = useLocation();
  const appVideosRef = useRef(null);
  const postRefs = useRef({}); // 포스트 ID를 키로, ref를 값으로 저장

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true); // 초기 로딩 상태
  const [isFetchingMore, setIsFetchingMore] = useState(false); // 추가 로딩 상태
  const [hasMore, setHasMore] = useState(true); // 더 불러올 포스트가 있는지
  const [lastPostCursor, setLastPostCursor] = useState(null); // 페이지네이션 커서

  // 포스트 데이터를 가져오는 함수
  const fetchPosts = useCallback(async (cursor) => {
    const isInitialLoad = !cursor;
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setIsFetchingMore(true);
    }

    let url = '/api/posts?limit=10';
    if (cursor) {
      const cursorString = JSON.stringify(cursor.createdAt);
      url += `&cursor=${encodeURIComponent(cursorString)}`;
    }

    try {
      const response = await fetch(url);
      const newPosts = await response.json();

      if (newPosts.length < 10) {
        setHasMore(false);
      }
      setPosts(prev => isInitialLoad ? newPosts : [...prev, ...newPosts]);
      if (newPosts.length > 0) {
        setLastPostCursor(newPosts[newPosts.length - 1]);
      }
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, []);

  // 초기 포스트 로딩
  useEffect(() => {
    fetchPosts(null);
  }, [fetchPosts]);

  // 무한 스크롤을 위한 IntersectionObserver 설정
  const observer = useRef();
  const lastPostElementRef = useCallback(node => {
    if (isFetchingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchPosts(lastPostCursor);
      }
    });
    if (node) observer.current.observe(node);
  }, [isFetchingMore, hasMore, lastPostCursor, fetchPosts]);

  // 앱 로드 시 URL에 포스트 ID가 있으면 해당 포스트로 스크롤
  useEffect(() => {
    const postId = location.pathname.split('/post/')[1];
    // posts가 로드된 후에 실행
    if (postId && posts.length > 0) {
      const postRef = postRefs.current[postId];
      if (postRef && appVideosRef.current) {
        // 렌더링 후 정확한 위치 계산을 위해 setTimeout 사용
        setTimeout(() => {
          appVideosRef.current.scrollTo({
            top: postRef.offsetTop,
            behavior: 'auto', // 페이지 로드 시에는 즉시 이동
          });
        }, 0);
      }
    }
  }, [location.pathname, posts]); // posts가 로드된 후에 실행되도록 의존성 추가

  if (loading && posts.length === 0) {
    return <div className="app-loading">Loading posts...</div>;
  }

  return (
    <div className="app">
      <div className="app__videos" ref={appVideosRef}>
        {posts.map((post, index) => {
          const isLast = index === posts.length - 1;
          return (
            <Post
              // ref를 함수로 전달하여 여러 목적(스크롤, 무한로딩)으로 사용
              ref={el => {
                postRefs.current[post.id] = el;
                if (isLast) lastPostElementRef(el);
              }}
              key={post.id}
              {...post}
            />
          );
        })}
        {isFetchingMore && <div className="app-loading">Loading more...</div>}
        {!loading && !hasMore && posts.length > 0 && (
          <div className="app-loading">You've seen it all!</div>
        )}
        {!loading && posts.length === 0 && (
          <div className="app-loading">No posts found.</div>
        )}
      </div>
    </div>
  );
}

export default App;