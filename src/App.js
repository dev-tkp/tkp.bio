import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import { useLocation } from 'react-router-dom';
import Post from './components/Post';

function App() {
  const location = useLocation();
  const appVideosRef = useRef(null);
  const postRefs = useRef({}); // 포스트 ID를 키로, ref를 값으로 저장

  // --- 상태 추가 ---
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true); // 초기 로딩 상태
  const [isFetchingMore, setIsFetchingMore] = useState(false); // 추가 로딩 상태
  const [hasMore, setHasMore] = useState(true); // 더 불러올 포스트가 있는지
  const [lastPostCursor, setLastPostCursor] = useState(null); // 페이지네이션 커서
  const [activePostIndex, setActivePostIndex] = useState(0); // 현재 활성화된 포스트 인덱스

  // --- 가상화를 위한 콜백 ---
  const handlePostVisible = useCallback((index) => {
    setActivePostIndex(index);
  }, []);

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

  // TODO: URL을 통해 특정 포스트로 직접 접근하는 기능은 가상화 도입으로 인해 로직 수정이 필요합니다.
  // 현재는 비활성화하며, 추후 개선이 필요합니다.
  // useEffect(() => {
  //   const postId = location.pathname.split('/post/')[1];
  //   if (postId && posts.length > 0) {
  //     const postIndex = posts.findIndex(p => p.id === postId);
  //     if (postIndex > -1 && postIndex !== activePostIndex) {
  //       setActivePostIndex(postIndex);
  //       // 스크롤 로직은 activePostIndex를 기반으로 한 다른 useEffect에서 처리될 수 있습니다.
  //     }
  //   }
  // }, [location.pathname, posts, activePostIndex]);

  if (loading && posts.length === 0) {
    return <div className="app-loading">Loading posts...</div>;
  }

  // --- 렌더링할 포스트 창(window) 계산 ---
  const RENDER_AHEAD = 2; // 현재 포스트 기준, 앞/뒤로 2개씩 더 렌더링
  const startIndex = Math.max(0, activePostIndex - RENDER_AHEAD);
  const endIndex = Math.min(posts.length, activePostIndex + RENDER_AHEAD + 1);
  const postsToRender = posts.slice(startIndex, endIndex);

  return (
    <div className="app">
      <div className="app__videos" ref={appVideosRef}>
        {postsToRender.map((post, relativeIndex) => {
          const actualIndex = startIndex + relativeIndex;
          const isLast = actualIndex === posts.length - 1;
          return (
            <Post
              // ref를 함수로 전달하여 여러 목적(스크롤, 무한로딩)으로 사용
              ref={el => {
                postRefs.current[post.id] = el;
                if (isLast) lastPostElementRef(el);
              }}
              key={post.id}
              index={actualIndex}
              onVisible={handlePostVisible}
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