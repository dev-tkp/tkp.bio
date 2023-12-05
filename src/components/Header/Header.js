import React, { useState } from 'react';

const Header = () => {
  const [showEmail, setShowEmail] = useState(false);
  const email = "tkpark0504@gmail.com"

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
          {email}
          <button className="copy-button" onClick={() => navigator.clipboard.writeText(email)}>
            Copy
          </button>
        </div>
      )}
    </header>
  );
};
