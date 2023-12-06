import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import './Header.css';
import upArrowIcon from './up-arrow.svg';
import downArrowIcon from './down-arrow.svg';
import copyIcon from './copy-icon.svg';

const getTextWidth = (text, fontSize) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `${fontSize}em Noto Sans`;
  return context.measureText(text).width;
};

const Header = () => {
  const [showEmail, setShowEmail] = useState(false);
  const [emailBoxMargin, setEmailBoxMargin] = useState(0);
  const email = "tkpark0504@gmail.com";

  useEffect(() => {
    const textWidth = getTextWidth("박태강", 1.6);
    setEmailBoxMargin(textWidth + 80);
  }, []);

  const handleCopyClick = () => {
    navigator.clipboard.writeText(email);
    toast("Copied to clipboard.");
  };

  const toggleEmail = () => {
    setShowEmail(!showEmail);
  };

  return (
    <header className="header">
      <div className="header-content">
        <span className="name">박태강</span>
        <button className="email-toggle" onClick={toggleEmail}>
          <img src={showEmail ? upArrowIcon : downArrowIcon} alt="Toggle Email" />
        </button>
      </div>
      {showEmail && (
        <div className="email-box" style={{ marginLeft: `${emailBoxMargin}px` }}>
          <span>{email}</span>
          <button className="copy-button" onClick={handleCopyClick}>
            <img src={copyIcon} alt="Copy Email" />
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
