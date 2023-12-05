import React, { useState } from 'react';
import './Header.css'; // Make sure you have the corresponding CSS file

const Header = () => {
  const [showEmail, setShowEmail] = useState(false);
  const email = "your-email@example.com"; // Replace with your actual email

  const toggleEmail = () => {
    setShowEmail(!showEmail);
  };

  return (
    <header className="header">
      <div className="header-content">
        <span className="name">박태강</span>
        <button className="email-toggle" onClick={toggleEmail}>
          {showEmail ? "↑" : "↓"}
        </button>
      </div>
      {showEmail && (
        <div className="email-box">
          <span>{email}</span>
          <button 
            className="copy-button" 
            onClick={() => navigator.clipboard.writeText(email)}
          >
            Copy
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
