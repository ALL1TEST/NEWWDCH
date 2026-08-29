// ============================================================
// BACKUP SCHEDULER MINI-SERVICE
// ============================================================
// A standalone long-running process that ticks every 60 seconds
// and invokes runScheduledBackups() directly (no HTTP round-trip).
//
// On each tick:
//   1. Queries the DB for active BackupSchedules whose nextRunAt <= now.
//   2. For each due schedule:
//      - Triggers createBackup() (synchronous — awaits the full
//        archive → encrypt → upload → verify flow).
//      - Applies the retention policy (deletes old COMPLETED backups
//        beyond retentionCount).
//      - Updates lastRunAt + nextRunAt.
//   3. Writes a BackupLog entry per schedule run (success or fail).
//
// The createBackup service itself writes the action='create' log
// entries; this mini-service writes the action='schedule_run'
// entries that tie a run to its schedule.
//
// Runs on its own port (3010) — but does NOT serve HTTP. The port
// is only used by Caddy's health-check; the loop is in-process.
// ============================================================

import { db } from '../../src/lib/db';
import { runScheduledBackups } from '../../src/lib/backup/backup-service';

const TICK_INTERVAL_MS = 60 * 1000; // 60 seconds
const PORT = 3010; // for caddy health-check / liveness

// Tiny HTTP listener so the gateway can verify the service is alive.
const http = await import('node:http');
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'backup-scheduler', port: PORT, ts: new Date().toISOString() }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[backup-scheduler] listening on :${PORT} (health-only)`);
});

console.log(`[backup-scheduler] starting — tick every ${TICK_INTERVAL_MS}ms`);

// Run the tick loop. The first run happens immediately on startup so
// any due schedules are picked up right away; subsequent ticks are
// spaced by TICK_INTERVAL_MS.
async function tick() {
  try {
    const before = new Date();
    const dueCount = await db.backupSchedule.count({
      where: { isActive: true, nextRunAt: { lte: before } },
    });

    if (dueCount === 0) {
      return; // nothing to do this tick
    }

    console.log(`[backup-scheduler] tick ${before.toISOString()} — ${dueCount} due schedule(s)`);

    // runScheduledBackups() handles the full flow per schedule:
    //   - Prevents duplicate execution (skips if a CREATING backup exists)
    //   - Triggers createBackup() (synchronous)
    //   - Applies retention policy
    //   - Updates lastRunAt + nextRunAt
    //   - Returns an array of { scheduleId, success, message }
    const results = await runScheduledBackups();

    for (const r of results) {
      // Write a BackupLog entry for each schedule run so the audit
      // trail reflects when each schedule ticked. The action='schedule_run'
      // value complements the action='create' log written by createBackup.
      try {
        await db.backupLog.create({
          data: {
            backupId: null,
            action: 'schedule_run',
            status: r.success ? 'success' : 'failed',
            warnings: r.message,
          },
        });
      } catch (logErr) {
        console.warn(`[backup-scheduler] failed to write log:`, logErr);
      }
    }

    console.log(`[backup-scheduler] tick complete — ${results.length} schedule(s) processed`);
  } catch (err) {
    console.error(`[backup-scheduler] tick failed:`, err);
  }
}

// Initial tick on startup
tick();

// Schedule recurring ticks
setInterval(tick, TICK_INTERVAL_MS);

// Keep the process alive
process.on('SIGTERM', () => {
  console.log('[backup-scheduler] SIGTERM received, shutting down');
  server.close();
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('[backup-scheduler] SIGINT received, shutting down');
  server.close();
  process.exit(0);
});
