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
  const [initialScrollDone, setInitialScrollDone] = useState(false);

  // --- 가상화를 위한 콜백 ---
  const handlePostVisible = useCallback((index) => {
    // 함수형 업데이트를 사용하여 activePostIndex 의존성을 제거
    setActivePostIndex(prevIndex => prevIndex !== index ? index : prevIndex);
  }, []);

  // 포스트 데이터를 가져오는 함수
  const fetchMorePosts = useCallback(async () => {
    if (isFetchingMore || !hasMore || !lastPostCursor) return;

    setIsFetchingMore(true);
    const cursorString = JSON.stringify(lastPostCursor.createdAt);
    const url = `/api/posts?limit=10&cursor=${encodeURIComponent(cursorString)}`;

    try {
      const response = await fetch(url);
      const newPosts = await response.json();

      if (newPosts.length < 10) {
        setHasMore(false);
      }
      setPosts(prev => [...prev, ...newPosts]);
      if (newPosts.length > 0) {
        setLastPostCursor(newPosts[newPosts.length - 1]);
      }
    } catch (error) {
      console.error("Failed to fetch more posts:", error);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, hasMore, lastPostCursor]);

  // 초기 포스트 로딩 및 URL 변경 감지
  useEffect(() => {
    const postId = location.pathname.split('/post/')[1];

    const fetchInitialData = async () => {
      setLoading(true);
      setInitialScrollDone(false); // Reset scroll flag on new load
      let url = postId ? `/api/post-initial-load?id=${postId}` : '/api/posts?limit=10';

      try {
        const response = await fetch(url);
        if (!response.ok) {
          // If direct load fails (e.g., 404), fall back to the main feed.
          if (postId) {
            console.warn(`Post ${postId} not found, loading main feed.`);
            const fallbackResponse = await fetch('/api/posts?limit=10');
            const fallbackPosts = await fallbackResponse.json();
            setPosts(fallbackPosts);
            if (fallbackPosts.length > 0) setLastPostCursor(fallbackPosts[fallbackPosts.length - 1]);
            setHasMore(fallbackPosts.length === 10);
          } else {
            throw new Error(`Failed to fetch: ${response.statusText}`);
          }
        } else {
          const data = await response.json();
          if (postId) {
            setPosts(data.posts);
            setActivePostIndex(data.initialPostIndex);
            if (data.posts.length > 0) setLastPostCursor(data.posts[data.posts.length - 1]);
            setHasMore(true); // Assume more posts exist in both directions
          } else {
            setPosts(data);
            if (data.length > 0) setLastPostCursor(data[data.length - 1]);
            setHasMore(data.length === 10);
          }
        }
      } catch (error) {
        console.error("Failed to fetch initial posts:", error);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [location.pathname]);

  // 무한 스크롤을 위한 IntersectionObserver 설정
  const observer = useRef();
  const lastPostElementRef = useCallback(node => {
    if (isFetchingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchMorePosts();
      }
    });
    if (node) observer.current.observe(node);
  }, [isFetchingMore, hasMore, fetchMorePosts]);

  // URL로 직접 접근 시 해당 포스트로 스크롤하는 기능
  useEffect(() => {
    if (!loading && !initialScrollDone) {
      const activePostId = posts[activePostIndex]?.id;
      if (activePostId && appVideosRef.current) {
        const postRef = postRefs.current[activePostId];
        if (postRef) {
          setTimeout(() => {
            appVideosRef.current.scrollTo({ top: postRef.offsetTop, behavior: 'auto' });
          }, 0);
        }
      }
      setInitialScrollDone(true);
    }
  }, [loading, initialScrollDone, posts, activePostIndex]);

  // --- Media Preloading Logic ---
  useEffect(() => {
    const nextPostIndex = activePostIndex + 1;
    if (nextPostIndex < posts.length) {
      const nextPost = posts[nextPostIndex];
      if (nextPost.background?.url) {
        // This gives the browser a hint to start fetching the next asset.
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = nextPost.background.type === 'video' ? 'video' : 'image';
        link.href = nextPost.background.url;
        document.head.appendChild(link);
        // The link tag can be removed in a cleanup function, but modern browsers
        // handle preloaded resources efficiently, making manual cleanup optional.
      }
    }
  }, [activePostIndex, posts]);

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