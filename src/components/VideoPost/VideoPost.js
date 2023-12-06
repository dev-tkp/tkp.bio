// VideoPost.js

import React from 'react';
import './VideoPost.css';

const VideoPost = ({ videoSrc, content }) => {
  return (
    <div className="video-post" style={{ backgroundImage: `url(${videoSrc})` }}>
      <div className="content">
        {content}
      </div>
    </div>
  );
};

export default VideoPost;
