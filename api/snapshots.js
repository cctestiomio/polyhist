const {
  readSnapshotStore,
  writeSnapshotStore,
  sanitizeSnapshotStore
} = require('../lib/snapshot-store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      const store = await readSnapshotStore();
      return res.status(200).json(store);
    }

    if (req.method === 'POST') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const clean = sanitizeSnapshotStore(payload);
      const saved = await writeSnapshotStore(clean);
      return res.status(200).json({ ok: true, snapshots: saved.snapshots.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('/api/snapshots failed:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
