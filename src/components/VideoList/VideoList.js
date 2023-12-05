import React from 'react';
import VideoPost from '../VideoPost/VideoPost';
import './VideoList.css'; // Ensure you have the corresponding CSS file

const VideoList = ({ videoPosts }) => {
  return (
    <div className="video-list">
      {videoPosts.map(post => (
        <VideoPost key={post.id} videoSrc={post.videoSrc} content={post.content} />
      ))}
    </div>
  );
};

export default VideoList;
