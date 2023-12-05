// VideoPost.js
import React from 'react';

const VideoPost = ({ videoSrc, content }) => {
  return (
    <div className="video-post">
      <img src={videoSrc} alt="Video content" className="video-gif" />
      <div className="content">
        {content}
      </div>
    </div>
  );
};

export default VideoPost;