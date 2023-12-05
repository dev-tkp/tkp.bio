// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VideoList from './components/VideoList/VideoList';
import Header from './components/Header/Header';
import videoPosts from './videoPostsData'; // Importing video posts data
import './App.css';

const App = () => {
  return (
    <Router>
      <div className="app">
        <Header />
        <Routes>
          <Route path="/" element={<VideoList videoPosts={videoPosts} />} />
          {/* You can add more routes here as needed */}
        </Routes>
      </div>
    </Router>
  );
};

export default App;
