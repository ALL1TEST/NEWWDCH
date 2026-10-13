import { runSchedulerCheck } from './scheduler-service';

declare global {
  // eslint-disable-next-line no-var
  var __schedulerDaemonTimer: NodeJS.Timeout | null | undefined;
  // eslint-disable-next-line no-var
  var __schedulerDaemonRunning: boolean | undefined;
}

const POLL_INTERVAL_MS = 10_000; // Poll every 10 seconds for due automations

export function startSchedulerDaemon(): void {
  if (globalThis.__schedulerDaemonTimer) {
    return; // Already initialized
  }

  console.log('[SCHEDULER:DAEMON] Initializing background scheduler daemon (interval: 10s)...');

  const tick = async () => {
    if (globalThis.__schedulerDaemonRunning) {
      return; // Skip tick if previous check is still in flight
    }

    globalThis.__schedulerDaemonRunning = true;
    try {
      const summary = await runSchedulerCheck({ waitForCompletion: false });
      if (summary.dueCount > 0) {
        console.log(`[SCHEDULER:DAEMON] Processed ${summary.dueCount} due automation(s):`, summary.results.map((r) => `${r.name}: ${r.message}`));
      }
    } catch (err) {
      console.error('[SCHEDULER:DAEMON] Error during scheduler cycle:', err);
    } finally {
      globalThis.__schedulerDaemonRunning = false;
    }
  };

  // Run initial tick after a brief 1s delay on startup, then every POLL_INTERVAL_MS
  setTimeout(() => {
    tick().catch(() => {});
  }, 1000);

  globalThis.__schedulerDaemonTimer = setInterval(() => {
    tick().catch(() => {});
  }, POLL_INTERVAL_MS);
}

export function stopSchedulerDaemon(): void {
  if (globalThis.__schedulerDaemonTimer) {
    clearInterval(globalThis.__schedulerDaemonTimer);
    globalThis.__schedulerDaemonTimer = null;
    globalThis.__schedulerDaemonRunning = false;
    console.log('[SCHEDULER:DAEMON] Stopped background scheduler daemon');
  }
}

export function isSchedulerDaemonRunning(): boolean {
  return Boolean(globalThis.__schedulerDaemonTimer);
}
