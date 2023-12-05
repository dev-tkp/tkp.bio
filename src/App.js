import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header/Header';
import VideoList from './components/VideoList/VideoList';
import videoPosts from './videoPostsData';
import './App.css';

const App = () => {
  const [containerHeight, setContainerHeight] = useState('70vh');

  useEffect(() => {
    const handleResize = () => {
      setContainerHeight('70vh');
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Router>
      <div className="app">
        <div className="gif-container" style={{ height: containerHeight }}>
          <Header />
          <Routes>
            <Route path="/" element={<VideoList videoPosts={videoPosts} />} />
            {/* You can add more routes here as needed */}
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
