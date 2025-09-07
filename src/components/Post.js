import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Post.css';
import ContactModal from './ContactModal';
import Toast from './Toast';

const CONTENT_MAX_LENGTH = 80;
const MY_EMAIL = 'tkpark0504@gmail.com';

function Post({ id, author, profilePic, content, background, createdAt }) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const videoRef = useRef(null);
  const postRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const isLongContent = content.length > CONTENT_MAX_LENGTH;

  // URL 업데이트를 위한 useEffect (모든 포스트에 적용)
  useEffect(() => {
    const currentPostRef = postRef.current;
    if (!currentPostRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // 화면에 보이면 URL 업데이트 (history에 쌓지 않음)
          navigate(`/post/${id}`, { replace: true });
        }
      },
      { threshold: 0.7 } // 70% 이상 보여야 인터섹션으로 간주하여 더 정확하게 판단
    );

    observer.observe(currentPostRef);
    return () => observer.unobserve(currentPostRef);
  }, [id, navigate]);

  // 비디오 제어를 위한 useEffect (비디오 포스트에만 적용)
  useEffect(() => {
    const currentPostRef = postRef.current;
    if (background?.type !== 'video' || !currentPostRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play();
        } else {
          videoRef.current?.pause();
          if (videoRef.current) videoRef.current.currentTime = 0;
        }
      },
      { threshold: 0.7 }
    );

    observer.observe(currentPostRef);

    // 컴포넌트가 언마운트될 때 observer 정리
    return () => observer.unobserve(currentPostRef);
  }, [background?.type]);

  // 컴포넌트가 언마운트될 때 토스트 타임아웃 정리
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // 클립보드 복사 및 토스트 표시 핸들러
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(MY_EMAIL).then(() => {
      setShowToast(true);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        setShowToast(false);
      }, 2000); // 2초 후 토스트 숨김
    }).catch(err => {
      console.error('이메일 복사에 실패했습니다: ', err);
    });
  };

  // '더보기' 버튼 클릭 시 확장하고, 이벤트 전파를 막습니다.
  const handleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(true);
  };

  // 모달 열기 및 자동 복사
  const openModal = (e) => {
    e.stopPropagation(); // 배경 클릭 이벤트 방지
    setIsModalOpen(true);
    handleCopyToClipboard();
  };

  const closeModal = () => setIsModalOpen(false);

  // 포스트 배경 클릭 시 텍스트를 다시 축소합니다.
  const handleCollapse = () => {
    if (isExpanded) {
      setIsExpanded(false);
    }
  };

  const displayedContent =
    isLongContent && !isExpanded
      ? `${content.substring(0, CONTENT_MAX_LENGTH)}... `
      : content;

  return (
    <div className="post" onClick={handleCollapse} ref={postRef} id={`post-${id}`}>
      {/* 배경 미디어 렌더링 */}
      {background && background.type === 'video' ? (
        <video ref={videoRef} className="post__background" src={background.url} loop muted playsInline />
      ) : (
        background && <img className="post__background" src={background.url} alt="포스트 배경" />
      )}

      {/* 하단 정보 영역 클릭 시 이벤트 전파를 막아, 의도치 않은 축소를 방지합니다. */}
      <div className="post__footer" onClick={(e) => e.stopPropagation()}>
        <div className="post__footerAuthor" onClick={openModal}>
          <img src={profilePic} alt={author} className="post__profilePic" />
          <div className="post__authorInfo">
            <strong>{author}</strong>
            <span className="post__createdAt">{createdAt}</span>
          </div>
        </div>
        <div className="post__footerDescription">
          <p>
            {displayedContent}
            {isLongContent && !isExpanded && (
              <button onClick={handleExpand} className="post__readMore">
                더보기
              </button>
            )}
          </p>
        </div>
      </div>

      <ContactModal
        isOpen={isModalOpen}
        onClose={closeModal}
        email={MY_EMAIL}
        onCopy={handleCopyToClipboard}
      />
      <Toast
        isVisible={showToast}
      />
    </div>
  );
}

export default Post;