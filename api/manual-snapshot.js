const { buildCurrentMetrics, buildSnapshotFromMetrics } = require('../lib/portfolio');
const { appendSnapshot } = require('../lib/snapshot-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.MANUAL_SNAPSHOT_SECRET;
  if (token) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${token}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const metrics = await buildCurrentMetrics();
    const snapshot = buildSnapshotFromMetrics(metrics);
    const result = await appendSnapshot(snapshot, { force: true });

    return res.status(200).json({
      ok: true,
      appended: result.appended,
      snapshot,
      snapshots: result.store.snapshots.length
    });
  } catch (error) {
    console.error('/api/manual-snapshot failed:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
