import React from 'react';
import './Toast.css';
import checkmarkIcon from '../assets/icons/checkmark-icon.png'; // 아이콘 import (상대 경로로 수정)

function Toast({ isVisible }) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className={`toast ${isVisible ? 'visible' : ''}`}>
      Copied
      <img src={checkmarkIcon} alt="Success" className="toast-icon" />
    </div>
  );
}

export default Toast;