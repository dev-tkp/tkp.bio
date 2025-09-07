import React, {
  useEffect,
  useRef,
  useState,
  useCallback
} from 'react';
import './App.css';
import { useLocation } from 'react-router-dom';
import Post from './components/Post.js';

function App() {
  const location = useLocation();
  const scrollContainerRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef();

  // 포스트를 가져오는 함수
  const fetchPosts = useCallback(async () => {
    // 로딩 중이거나 더 이상 포스트가 없으면 실행하지 않음
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);
    try {
      // nextCursor가 있으면 쿼리 파라미터로 추가
      const url = nextCursor ? `/api/posts?cursor=${nextCursor}` : '/api/posts';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // 중복 포스트 방지
      setPosts(prevPosts => {
        const existingIds = new Set(prevPosts.map(p => p.id));
        const newPosts = data.posts.filter(p => !existingIds.has(p.id));
        return [...prevPosts, ...newPosts];
      });

      setNextCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch (e) {
      console.error("Failed to fetch posts:", e);
      setError("Failed to load posts. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [nextCursor, loading, hasMore]);

  // 초기 포스트 로드
  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 한 번만 실행

  // 앱 로드 시 URL에 포스트 ID가 있으면 해당 포스트로 스크롤
  useEffect(() => {
    if (posts.length === 0) return; // 포스트가 로드되기 전에는 실행하지 않음

    const postId = location.pathname.split('/post/')[1];
    if (postId) {
      const postElement = document.getElementById(`post-${postId}`);
      if (postElement && scrollContainerRef.current) {
        // 렌더링 후 정확한 위치 계산을 위해 setTimeout 사용
        setTimeout(() => {
          scrollContainerRef.current.scrollTo({
            top: postElement.offsetTop,
            behavior: 'auto', // 페이지 로드 시에는 즉시 이동
          });
        }, 0);
      }
    }
  }, [location.pathname, posts]); // posts가 로드된 후에 실행되도록 의존성 추가
  
  // 무한 스크롤을 위한 IntersectionObserver 설정
  const lastPostElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchPosts();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, fetchPosts]);


  if (loading && posts.length === 0) {
    return <div className="app-loading">Loading posts...</div>;
  }

  if (error) {
    return <div className="app-loading">{error}</div>;
  }

  return (
    <div className="app">
      <div className="app__videos" ref={scrollContainerRef}>
        {posts.length > 0 ? (
          posts.map((post, index) => {
            if (posts.length === index + 1) {
              // 마지막 포스트에 ref를 연결하여 무한 스크롤 트리거로 사용
              return <Post ref={lastPostElementRef} key={post.id} {...post} />;
            }
            return <Post key={post.id} {...post} />;
          })
        ) : (
          !loading && <div className="app-loading">No posts found.</div>
        )}
        {loading && <div className="app-loading">Loading more posts...</div>}
        {!hasMore && posts.length > 0 && <div className="app-loading">You've seen it all!</div>}
      </div>
    </div>
  );
}

export default App;