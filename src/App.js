import React, { useState, useEffect } from 'react';
import useViewportSize from './useViewportSize';
import Header from './components/Header/Header';
import VideoList from './components/VideoList/VideoList';
import videoPosts from './videoPostsData';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

const App = () => {
  const { height, width } = useViewportSize();
  const [containerHeight, setContainerHeight] = useState('100vh');

  useEffect(() => {
    // Set container height to 80% for desktop and 100% for mobile
    if (width >= 769) {
      setContainerHeight('80vh');
    } else {
      setContainerHeight(`${height}px`);
    }
  }, [height, width]);

  return (
    <div className="app">
      <ToastContainer position="bottom-center" />
      <div className="content-container" style={{ height: containerHeight }}>
        <Header />
        <div className="gif-container">
          <VideoList videoPosts={videoPosts} />
        </div>
      </div>
    </div>
  );
};

export default App;
