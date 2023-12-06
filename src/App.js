import React, { useState, useEffect } from 'react';
import Header from './components/Header/Header';
import VideoList from './components/VideoList/VideoList';
import videoPosts from './videoPostsData';
import './App.css';

const App = () => {
  const [containerHeight, setContainerHeight] = useState(window.innerHeight * 0.7);

  useEffect(() => {
    const handleResize = () => {
      setContainerHeight(window.innerHeight * 0.7);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app">
      <div className="gif-container">
        <Header />
        <VideoList videoPosts={videoPosts} containerHeight={containerHeight} />
      </div>
    </div>
  );
};

export default App;