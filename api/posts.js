import { db } from './lib/firebase';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  console.log(`API Route /api/posts received a ${req.method} request.`);

  if (req.method !== 'GET') {
    console.log(`Method ${req.method} is not allowed.`);
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { cursor, limit = '10' } = req.query;
    const postsLimit = parseInt(limit, 10);

    console.log(`Querying posts with limit: ${postsLimit} and cursor: ${cursor}`);

    let query = db.collection('posts')
      .where("deleted", "==", false) // 삭제되지 않은 포스트만 조회
      .orderBy('createdAt', 'desc');

    if (cursor) {
      try {
        // The cursor is the stringified JSON of the last post's createdAt timestamp object
        const { _seconds, _nanoseconds } = JSON.parse(cursor);
        const lastVisibleTimestamp = new Timestamp(_seconds, _nanoseconds);
        query = query.startAfter(lastVisibleTimestamp);
      } catch (e) {
        console.error("Invalid cursor format:", cursor, e);
        return res.status(400).json({ error: "Invalid cursor format." });
      }
    }

    const snapshot = await query.limit(postsLimit).get();

    console.log(`Firestore query completed. Snapshot empty: ${snapshot.empty}, size: ${snapshot.size}.`);

    if (snapshot.empty) {
      console.log("No more documents found. Returning an empty array.");
      return res.status(200).json([]);
    }

    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Successfully mapped ${posts.length} documents. Sending response.`);
    res.status(200).json(posts);

  } catch (error) {
    console.error('Error fetching posts from Firestore:', error);
    res.status(500).json({ 
      error: 'Internal Server Error while fetching posts.', 
      details: error.message 
    });
  }
}