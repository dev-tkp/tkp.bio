import { db } from './lib/firebase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Post ID is required." });
  }

  // 대상 포스트를 기준으로 앞/뒤로 5개씩 더 불러옵니다.
  const RENDER_AHEAD = 5;

  try {
    console.log(`[Initial Load] Fetching target post with ID: ${id}`);
    const docRef = db.collection('posts').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.error(`[Initial Load] Target post with ID: ${id} not found in Firestore.`);
      return res.status(404).json({ error: "Post not found." });
    }

    // 대상 포스트보다 최신 포스트(더 이전 시간)를 가져옵니다.
    const newerPostsQuery = db.collection('posts')
      .orderBy('createdAt', 'desc')
      .endBefore(docSnap)
      .limitToLast(RENDER_AHEAD);

    // 대상 포스트 및 그보다 오래된 포스트를 가져옵니다.
    const olderPostsQuery = db.collection('posts')
      .orderBy('createdAt', 'desc')
      .startAt(docSnap)
      .limit(RENDER_AHEAD + 1); // +1 for the target post itself

    const [newerSnapshot, olderSnapshot] = await Promise.all([
      newerPostsQuery.get(),
      olderPostsQuery.get(),
    ]);

    const newerPosts = newerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const olderPosts = olderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`[Initial Load] Found ${newerPosts.length} newer posts and ${olderPosts.length} older posts (including target).`);
    const combinedPosts = [...newerPosts, ...olderPosts];
    const initialPostIndex = newerPosts.length;

    res.status(200).json({
      posts: combinedPosts,
      initialPostIndex: initialPostIndex,
    });
  } catch (error) {
    console.error('Error fetching initial post load:', error);
    res.status(500).json({
      error: 'Internal Server Error while fetching initial post data.',
      details: error.message,
    });
  }
}