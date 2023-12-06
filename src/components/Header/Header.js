import React, { useState } from 'react';
import './Header.css'; // Make sure you have the corresponding CSS file
import upArrowIcon from './up-arrow.svg'; // Path to your up arrow icon
import downArrowIcon from './down-arrow.svg'; // Path to your down arrow icon
import copyIcon from './copy-icon.svg'; // Path to your copy icon


const Header = () => {
  const [showEmail, setShowEmail] = useState(false);
  const email = "tkpark0504@gmail.com";

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
        <div className="email-box">
          <span>{email}</span>
          <button className="copy-button" onClick={() => navigator.clipboard.writeText(email)}>
            <img src={copyIcon} alt="Copy Email" />
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
