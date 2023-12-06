// videoPostsData.js

import img1 from './demo1.gif'
import img2 from './demo2.gif'
import img3 from './demo3.gif'

const videoPosts = [
  {
    id: 1,
    videoSrc: img1, // Update this path to your gif file
    content: 'This is an example video post.'
  },
  {
    id: 2,
    videoSrc: img2, // Update this path to your gif file
    content:`Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.`
  },
  {
    id: 3,
    videoSrc: img3, // Update this path to your gif file
    content: 'This is an example video post.'
  },
  // ... more posts
];

export default videoPosts;