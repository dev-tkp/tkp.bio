import admin from 'firebase-admin';

// Firebase Admin SDK 초기화
// Vercel 환경에서는 함수가 호출될 때마다 이 코드가 실행될 수 있으므로,
// admin.apps.length 체크는 매우 중요합니다.
if (!admin.apps.length) {
  try {
    console.log('Initializing Firebase Admin SDK...');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error.stack);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  console.log(`API Route /api/posts received a ${req.method} request.`);

  if (req.method !== 'GET') {
    console.log(`Method ${req.method} is not allowed.`);
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    console.log("Attempting to query 'posts' collection from Firestore...");
    const postsCollection = db.collection('posts');
    const snapshot = await postsCollection.orderBy('createdAt', 'desc').get();
    
    console.log(`Firestore query completed. Snapshot empty: ${snapshot.empty}, size: ${snapshot.size}.`);

    if (snapshot.empty) {
      console.log("No documents found. Returning an empty array.");
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