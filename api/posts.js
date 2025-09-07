import { db } from './lib/firebase';

const POSTS_PER_PAGE = 10; // 한 번에 가져올 포스트 수

export default async function handler(req, res) {
  console.log(`API Route /api/posts received a ${req.method} request.`);

  if (req.method !== 'GET') {
    console.log(`Method ${req.method} is not allowed.`);
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { cursor } = req.query; // 클라이언트에서 보낸 마지막 포스트의 ID

  try {
    console.log("Attempting to query 'posts' collection from Firestore...");
    let query = db.collection('posts').orderBy('createdAt', 'desc');

    if (cursor) {
      console.log(`Querying with cursor: ${cursor}`);
      const lastVisibleDoc = await db.collection('posts').doc(cursor).get();
      if (!lastVisibleDoc.exists) {
        return res.status(404).json({ error: 'Cursor document not found.' });
      }
      query = query.startAfter(lastVisibleDoc);
    }

    // 다음 페이지가 있는지 확인하기 위해 요청된 개수보다 하나 더 가져옵니다.
    const snapshot = await query.limit(POSTS_PER_PAGE + 1).get();

    console.log(`Firestore query completed. Fetched ${snapshot.size} documents.`);

    if (snapshot.empty) {
      console.log("No more documents found. Returning empty response.");
      return res.status(200).json({ posts: [], nextCursor: null });
    }

    const hasMore = snapshot.docs.length > POSTS_PER_PAGE;
    const posts = snapshot.docs
      .slice(0, POSTS_PER_PAGE)
      .map(doc => ({ id: doc.id, ...doc.data() }));

    // 다음 쿼리를 위한 커서는 마지막으로 가져온 문서의 ID입니다.
    const nextCursor = hasMore ? posts[posts.length - 1].id : null;

    console.log(`Successfully mapped ${posts.length} documents. HasMore: ${hasMore}. Next cursor: ${nextCursor}`);
    res.status(200).json({ posts, nextCursor });

  } catch (error) {
    console.error('Error fetching posts from Firestore:', error);
    // 개발 환경에서는 더 자세한 에러를, 프로덕션에서는 일반적인 메시지를 보냅니다.
    const isDev = process.env.NODE_ENV === 'development';
    res.status(500).json({
      message: 'Internal Server Error while fetching posts.',
      // Firebase 초기화 실패 등 더 근본적인 원인을 파악하는 데 도움이 될 수 있습니다.
      error: isDev ? error.message : 'An unexpected error occurred.',
      stack: isDev ? error.stack : undefined,
    });
  }
}