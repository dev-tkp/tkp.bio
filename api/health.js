export default function handler(req, res) {
  console.log('[health] Health check API was called successfully.');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}