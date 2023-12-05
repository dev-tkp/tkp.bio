import React from 'react';
import './VideoPost.css'; // Make sure you have the corresponding CSS file

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
