import React from 'react';
import Header from './components/Header/Header';
import VideoList from './components/VideoList/VideoList';
import videoPosts from './videoPostsData';
import './App.css';

const App = () => {
 
  return (
    <div className="app">
      <div className="content-container" >
        <Header />
        <div className="gif-container">
          <VideoList videoPosts={videoPosts} />
        </div>
      </div>
    </div>
  );
};

export default App;
