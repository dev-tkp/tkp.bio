import admin from 'firebase-admin';

// Firebase Admin SDK 초기화
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error);
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const postsCollection = db.collection('posts');
      const snapshot = await postsCollection.orderBy('createdAt', 'desc').get();

      if (snapshot.empty) {
        return res.status(200).json([]);
      }

      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.status(200).json(posts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}