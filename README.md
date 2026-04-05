# Polymarket Portfolio Tracker on Vercel

This version is set up for GitHub -> Vercel deployment.

## What changed

- `server.js` is no longer needed for production.
- Snapshots are stored in **Vercel Blob** instead of a local JSON file.
- The existing `index.html` still works and continues to read/write `/api/snapshots`.
- A Vercel cron job calls `/api/cron-snapshot` once per day.
- Your current uploaded snapshot history is included as `polymarket-snapshots.seed.json` and is used as the initial fallback until Blob has a saved copy.

## Files

- `index.html` — frontend
- `api/snapshots.js` — GET/POST snapshot store
- `api/cron-snapshot.js` — daily server-side snapshot job
- `api/manual-snapshot.js` — optional manual server-side snapshot trigger
- `lib/portfolio.js` — Polymarket + Polygon fetch logic
- `lib/snapshot-store.js` — Blob-backed snapshot persistence
- `polymarket-snapshots.seed.json` — initial seed data
- `vercel.json` — Vercel config + cron schedule

## Deploy steps

1. Push this folder to a GitHub repo.
2. Import the repo into Vercel.
3. In Vercel, open **Storage** and create a **Blob** store.
4. Attach the Blob store to the project so Vercel adds `BLOB_READ_WRITE_TOKEN`.
5. Add an environment variable:
   - `CRON_SECRET` = a random secret string
6. Redeploy.

## Cron schedule

The project is currently configured with:

- `5 7 * * *` -> **07:05 UTC daily**

That matches **12:05 AM in Los Angeles during daylight saving time**.

Important: on **Vercel Hobby**, cron jobs only run **once per day** and are only **hour-precision**, so you cannot get exact local-midnight behavior year-round, especially across DST changes. If you want tighter timing, use Vercel Pro and adjust the schedule or run more frequently. 

## Optional manual server-side snapshot

If you want to trigger a server-side snapshot yourself:

```bash
curl -X POST https://YOUR_DOMAIN/api/manual-snapshot \
  -H "Authorization: Bearer YOUR_MANUAL_SNAPSHOT_SECRET"
```

If you want that protected, also add:

- `MANUAL_SNAPSHOT_SECRET` = another random secret

## Local dev

You can still open `index.html` in a simple local server, but the Vercel APIs are meant to run in Vercel Functions.
