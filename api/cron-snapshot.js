const { buildCurrentMetrics, buildSnapshotFromMetrics } = require('../lib/portfolio');
const { appendSnapshot } = require('../lib/snapshot-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const metrics = await buildCurrentMetrics();
    const snapshot = buildSnapshotFromMetrics(metrics);
    const result = await appendSnapshot(snapshot, { force: true });

    return res.status(200).json({
      ok: true,
      appended: result.appended,
      ts: snapshot.ts,
      totalPortfolio: snapshot.totalPortfolio,
      totalCash: snapshot.totalCash,
      totalPositionValue: snapshot.totalPositionValue,
      snapshots: result.store.snapshots.length,
      note: 'Cron is scheduled for 07:05 UTC daily.'
    });
  } catch (error) {
    console.error('/api/cron-snapshot failed:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
