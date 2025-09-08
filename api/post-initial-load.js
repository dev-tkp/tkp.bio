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
      console.warn(`[Initial Load] Target post with ID: ${id} not found in Firestore.`);
      return res.status(404).json({ error: "Post not found." });
    }

    // soft-delete된 포스트로 직접 접근하는 것을 막습니다.
    if (docSnap.data().deleted === true) {
      console.warn(`[Initial Load] Attempted to access a deleted post. ID: ${id}`);
      return res.status(404).json({ error: "Post not found." });
    }

    // 대상 포스트보다 최신 포스트(더 이전 시간)를 가져옵니다.
    const newerPostsQuery = db.collection('posts')
      .where("deleted", "==", false)
      // 쿼리 방향을 뒤집어 안정성을 높입니다.
      .orderBy('createdAt', 'asc')
      .startAfter(docSnap)
      .limit(RENDER_AHEAD);

    // 대상 포스트 및 그보다 오래된 포스트를 가져옵니다.
    const olderPostsQuery = db.collection('posts')
      .where("deleted", "==", false)
      .orderBy('createdAt', 'desc')
      .startAt(docSnap)
      .limit(RENDER_AHEAD + 1); // +1 for the target post itself

    const [newerSnapshot, olderSnapshot] = await Promise.all([
      newerPostsQuery.get(),
      olderPostsQuery.get(),
    ]);

    // 오름차순으로 가져온 최신 포스트 배열을 다시 뒤집어 시간순으로 맞춥니다.
    const newerPosts = newerSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .reverse();
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