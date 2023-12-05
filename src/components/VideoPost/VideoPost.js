import React from 'react';
import 'video.js/dist/video-js.css';
import videojs from 'video.js';

const VideoPost = ({ videoSrc, content }) => {
  const videoNode = React.useRef(null);
  const player = React.useRef(null);

  React.useEffect(() => {
    // Instantiate Video.js
    player.current = videojs(videoNode.current, {
      autoplay: true,
      controls: true,
      responsive: true,
      sources: [{
        src: videoSrc,
        type: 'video/mp4'
      }]
    });

    // Dispose the player on component unmount
    return () => {
      if (player.current) {
        player.current.dispose();
      }
    };
  }, [videoSrc]);

  return (
    <div>
      <div data-vjs-player>
        <video ref={videoNode} className="video-js vjs-big-play-centered" />
      </div>
      <div className="content">
        {content}
      </div>
    </div>
  );
};

export default VideoPost;