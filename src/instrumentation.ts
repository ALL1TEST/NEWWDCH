export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSchedulerDaemon } = await import('@/lib/automation/scheduler-daemon');
    startSchedulerDaemon();
  }
}
