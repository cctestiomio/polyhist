const fs = require('node:fs/promises');
const path = require('node:path');
const { list, put, get } = require('@vercel/blob');
const {
  SNAPSHOT_BLOB_PATH,
  SNAPSHOT_MAX_ITEMS,
  SNAPSHOT_MIN_INTERVAL_MS
} = require('./constants');

const seedPath = path.join(process.cwd(), 'polymarket-snapshots.seed.json');

function emptyStore() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    snapshots: []
  };
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function sanitizeSnapshotStore(raw) {
  if (!raw || typeof raw !== 'object') {
    return emptyStore();
  }

  const cleaned = Array.isArray(raw.snapshots)
    ? raw.snapshots.map((snapshot) => ({
        ts: typeof snapshot.ts === 'string' ? snapshot.ts : new Date().toISOString(),
        totalPortfolio: Number(snapshot.totalPortfolio || 0),
        totalCash: Number(snapshot.totalCash || 0),
        totalPositionValue: Number(snapshot.totalPositionValue || 0),
        totalUnrealized: Number(snapshot.totalUnrealized || 0),
        totalRealized: Number(snapshot.totalRealized || 0),
        totalPnl: Number(snapshot.totalPnl || 0),
        wallets: Array.isArray(snapshot.wallets) ? snapshot.wallets : []
      }))
    : [];

  cleaned.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  return {
    version: Number(raw.version || 1),
    createdAt: raw.createdAt || new Date().toISOString(),
    snapshots: cleaned
  };
}

function snapshotsAreSame(a, b) {
  if (!a || !b) return false;

  const keys = [
    'totalPortfolio',
    'totalCash',
    'totalPositionValue',
    'totalUnrealized',
    'totalRealized',
    'totalPnl'
  ];

  return keys.every((key) => Math.abs(Number(a[key] || 0) - Number(b[key] || 0)) < 0.005);
}

async function readSeedStore() {
  try {
    const raw = await fs.readFile(seedPath, 'utf8');
    return sanitizeSnapshotStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

async function findSnapshotBlob() {
  if (!hasBlobToken()) return null;

  const result = await list({
    prefix: SNAPSHOT_BLOB_PATH,
    limit: 100,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  return result.blobs.find((blob) => blob.pathname === SNAPSHOT_BLOB_PATH) || null;
}

async function readSnapshotStore() {
  if (!hasBlobToken()) {
    return readSeedStore();
  }

  const blob = await findSnapshotBlob();

  if (!blob) {
    return readSeedStore();
  }

  const result = await get(blob.url, {
    access: 'private',
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  if (!result?.stream) {
    return readSeedStore();
  }

  const raw = await new Response(result.stream).text();
  return sanitizeSnapshotStore(JSON.parse(raw));
}

async function writeSnapshotStore(store) {
  if (!hasBlobToken()) {
    throw new Error(
      'Missing BLOB_READ_WRITE_TOKEN. In Vercel, create/attach Blob storage to this project first.'
    );
  }

  const clean = sanitizeSnapshotStore(store);

  await put(SNAPSHOT_BLOB_PATH, JSON.stringify(clean, null, 2), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  return clean;
}

async function appendSnapshot(snapshot, { force = false } = {}) {
  const store = await readSnapshotStore();
  const list = store.snapshots;
  const last = list.length ? list[list.length - 1] : null;
  const nowMs = new Date(snapshot.ts).getTime();
  const lastMs = last ? new Date(last.ts).getTime() : 0;

  const shouldAppend =
    force ||
    !last ||
    nowMs - lastMs >= SNAPSHOT_MIN_INTERVAL_MS ||
    !snapshotsAreSame(last, snapshot);

  if (!shouldAppend) {
    return { store, appended: false };
  }

  list.push(snapshot);

  if (list.length > SNAPSHOT_MAX_ITEMS) {
    store.snapshots = list.slice(-SNAPSHOT_MAX_ITEMS);
  }

  const saved = await writeSnapshotStore(store);
  return { store: saved, appended: true };
}

module.exports = {
  readSnapshotStore,
  writeSnapshotStore,
  appendSnapshot,
  sanitizeSnapshotStore,
  snapshotsAreSame
};
