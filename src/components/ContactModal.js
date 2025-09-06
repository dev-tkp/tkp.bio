import React from 'react';
import './ContactModal.css';
import clipboardIcon from '../assets/icons/clipboard-icon.png'; // 아이콘 import (상대 경로로 수정)

function ContactModal({ isOpen, onClose, email, onCopy }) {
  if (!isOpen) {
    return null;
  }

  const handleCopyClick = (e) => {
    e.stopPropagation(); // 모달이 닫히는 것을 방지
    onCopy();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Contact Me</h3>
        <div className="modal-email-container">
          <span>{email}</span>
          <button className="copy-icon-btn" onClick={handleCopyClick} title="Copy email">
            <img src={clipboardIcon} alt="Copy to clipboard" />
          </button>
        </div>
        <button className="modal-close-btn" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}

export default ContactModal;