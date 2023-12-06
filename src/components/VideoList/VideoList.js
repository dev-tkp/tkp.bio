// VideoList.js

import React from 'react';
import VideoPost from '../VideoPost/VideoPost';

const VideoList = ({ videoPosts, containerHeight }) => {
  return (
    <div className="video-list">
      {videoPosts.map(post => (
        <VideoPost 
          key={post.id} 
          videoSrc={post.videoSrc} 
          content={post.content} 
          style={{ height: containerHeight }} 
        />
      ))}
    </div>
  );
};

export default VideoList;
