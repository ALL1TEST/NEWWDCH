// ============================================================
// Automation Scheduler Utilities
// Calculates robust next execution times for DAILY, WEEKLY, MONTHLY
// respecting configured time, frequency, and timezones.
// ============================================================

export interface ScheduleConfig {
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | string;
  time?: string; // "HH:mm"
  timezone?: string; // IANA timezone, e.g. "UTC", "America/New_York", etc.
  startDate?: string; // "YYYY-MM-DD"
  dayOfWeek?: number; // 0 (Sunday) to 6 (Saturday)
  dayOfMonth?: number; // 1 to 31
  articlesPerDay?: number; // 1, 2, 3, 5, or custom number
}

/**
 * Convert canonical 24-hour time "HH:mm" (or existing "h:mm a") to 12-hour format with AM/PM.
 * Examples:
 *   "23:56" -> "11:56 PM"
 *   "00:15" -> "12:15 AM"
 *   "12:00" -> "12:00 PM"
 *   "00:00" -> "12:00 AM"
 *   "09:00" -> "9:00 AM"
 *   "14:30" -> "2:30 PM"
 */
export function formatScheduleTimeTo12Hour(timeStr?: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
  if (!match) return trimmed;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const periodArg = match[3]?.toUpperCase();
  if (periodArg === 'PM' && hour < 12) hour += 12;
  if (periodArg === 'AM' && hour === 12) hour = 0;
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mStr = String(minute).padStart(2, '0');
  return `${h12}:${mStr} ${period}`;
}

/**
 * Formats the next scheduled execution relative to the current instant in the configured timezone:
 * - Same calendar day: `Today at 6:25 PM`
 * - Next calendar day: `Tomorrow at 6:25 PM`
 * - Later dates: `Oct 14 at 6:25 PM`
 */
export function formatUpcomingExecution(
  targetDate: Date | string,
  timeZone: string = 'Africa/Casablanca',
  now: Date = new Date()
): string {
  const d = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  if (!d || isNaN(d.getTime())) return '—';

  const tz = isValidTimezone(timeZone) ? timeZone : 'Africa/Casablanca';

  const dtfDate = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const partsNow = dtfDate.formatToParts(now);
  const getVal = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  const nowY = getVal(partsNow, 'year');
  const nowM = getVal(partsNow, 'month');
  const nowD = getVal(partsNow, 'day');

  const partsTarget = dtfDate.formatToParts(d);
  const targetY = getVal(partsTarget, 'year');
  const targetM = getVal(partsTarget, 'month');
  const targetD = getVal(partsTarget, 'day');

  const dNow = new Date(Date.UTC(nowY, nowM - 1, nowD));
  const dTarget = new Date(Date.UTC(targetY, targetM - 1, targetD));
  const dayDiff = Math.round((dTarget.getTime() - dNow.getTime()) / (24 * 60 * 60 * 1000));

  const dtfTime = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const timeStr = dtfTime.format(d);

  if (dayDiff === 0) {
    return `Today at ${timeStr}`;
  }
  if (dayDiff === 1) {
    return `Tomorrow at ${timeStr}`;
  }

  const dtfMonthDay = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
  });
  return `${dtfMonthDay.format(d)} at ${timeStr}`;
}

export function parseScheduleTime(timeStr: string = '09:00'): { hour: number; minute: number } {
  const trimmed = (timeStr || '09:00').trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3]?.toLowerCase();
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return { hour: Math.max(0, Math.min(23, h)), minute: Math.max(0, Math.min(59, m)) };
  }
  return { hour: 9, minute: 0 };
}

/**
 * Calculate the next execution time for a given schedule configuration.
 * Always returns a Date strictly in the future relative to fromDate.
 * If today's scheduled time has already passed, calculates the next occurrence.
 */
export function calculateNextRun(
  rawConfig: ScheduleConfig | string,
  fromDate: Date = new Date(),
  options: { advancePastNow?: boolean } = {}
): Date {
  let cfg: ScheduleConfig = {};
  if (typeof rawConfig === 'string') {
    try {
      cfg = JSON.parse(rawConfig || '{}');
    } catch {
      cfg = {};
    }
  } else if (rawConfig && typeof rawConfig === 'object') {
    cfg = rawConfig;
  }

  const frequency = (cfg.frequency || 'DAILY').toUpperCase();
  const { hour: targetHour, minute: targetMinute } = parseScheduleTime(cfg.time || '09:00');
  const tz = isValidTimezone(cfg.timezone) ? cfg.timezone! : 'Africa/Casablanca';

  // Build a base date in UTC
  const now = new Date(fromDate);
  let candidate: Date;

  if (tz === 'UTC') {
    let year = now.getUTCFullYear();
    let month = now.getUTCMonth();
    let day = now.getUTCDate();

    if (cfg.startDate) {
      const [sY, sM, sD] = cfg.startDate.split('-').map(Number);
      if (sY && sM && sD) {
        const isFuture =
          sY > now.getUTCFullYear() ||
          (sY === now.getUTCFullYear() && (sM - 1) > now.getUTCMonth()) ||
          (sY === now.getUTCFullYear() && (sM - 1) === now.getUTCMonth() && sD > now.getUTCDate());
        if (isFuture) {
          year = sY;
          month = sM - 1;
          day = sD;
        }
      }
    }

    candidate = new Date(Date.UTC(year, month, day, targetHour, targetMinute, 0, 0));

    if (options.advancePastNow && candidate > now) {
      if (frequency === 'WEEKLY') {
        candidate.setUTCDate(candidate.getUTCDate() + 7);
      } else if (frequency === 'MONTHLY') {
        candidate.setUTCMonth(candidate.getUTCMonth() + 1);
      } else {
        candidate.setUTCDate(candidate.getUTCDate() + 1);
      }
    }

    if (candidate <= now) {
      if (frequency === 'WEEKLY') {
        while (candidate <= now) {
          candidate.setUTCDate(candidate.getUTCDate() + 7);
        }
      } else if (frequency === 'MONTHLY') {
        while (candidate <= now) {
          candidate.setUTCMonth(candidate.getUTCMonth() + 1);
        }
      } else {
        // DAILY
        while (candidate <= now) {
          candidate.setUTCDate(candidate.getUTCDate() + 1);
        }
      }
    }
  } else {
    // Timezone-aware calculation using Intl
    try {
      candidate = calculateZonedNextRun(now, targetHour, targetMinute, frequency, tz, cfg.startDate, options);
    } catch {
      // Fallback to UTC if timezone calculation errors
      candidate = new Date(now);
      candidate.setUTCHours(targetHour, targetMinute, 0, 0);
      if (candidate <= now) {
        candidate.setUTCDate(candidate.getUTCDate() + (frequency === 'WEEKLY' ? 7 : frequency === 'MONTHLY' ? 30 : 1));
      }
    }
  }

  return candidate;
}

function isValidTimezone(tz?: string): boolean {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function calculateZonedNextRun(
  now: Date,
  targetHour: number,
  targetMinute: number,
  frequency: string,
  timeZone: string,
  startDateStr?: string,
  options: { advancePastNow?: boolean } = {}
): Date {
  const nowParts = getZonedParts(now, timeZone);
  let year = nowParts.year;
  let month = nowParts.month;
  let day = nowParts.day;

  if (startDateStr) {
    const [sY, sM, sD] = startDateStr.split('-').map(Number);
    if (sY && sM && sD) {
      const isFutureDate =
        sY > nowParts.year ||
        (sY === nowParts.year && sM > nowParts.month) ||
        (sY === nowParts.year && sM === nowParts.month && sD > nowParts.day);

      if (isFutureDate) {
        year = sY;
        month = sM;
        day = sD;
      }
    }
  }

  let candidate = createDateInTz(year, month, day, targetHour, targetMinute, timeZone);

  // If explicitly requested to advance past now even if candidate is in the future
  if (options.advancePastNow && candidate > now) {
    if (frequency === 'WEEKLY') {
      const cp = getZonedParts(candidate, timeZone);
      candidate = createDateInTz(cp.year, cp.month, cp.day + 7, targetHour, targetMinute, timeZone);
    } else if (frequency === 'MONTHLY') {
      const cp = getZonedParts(candidate, timeZone);
      candidate = createDateInTz(cp.year, cp.month + 1, cp.day, targetHour, targetMinute, timeZone);
    } else {
      const cp = getZonedParts(candidate, timeZone);
      candidate = createDateInTz(cp.year, cp.month, cp.day + 1, targetHour, targetMinute, timeZone);
    }
  }

  // If candidate time has already passed relative to now, advance to next occurrence
  if (candidate <= now) {
    if (frequency === 'WEEKLY') {
      while (candidate <= now) {
        const cp = getZonedParts(candidate, timeZone);
        candidate = createDateInTz(cp.year, cp.month, cp.day + 7, targetHour, targetMinute, timeZone);
      }
    } else if (frequency === 'MONTHLY') {
      while (candidate <= now) {
        const cp = getZonedParts(candidate, timeZone);
        candidate = createDateInTz(cp.year, cp.month + 1, cp.day, targetHour, targetMinute, timeZone);
      }
    } else {
      // DAILY
      while (candidate <= now) {
        const cp = getZonedParts(candidate, timeZone);
        candidate = createDateInTz(cp.year, cp.month, cp.day + 1, targetHour, targetMinute, timeZone);
      }
    }
  }

  return candidate;
}

function getZonedParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = parseInt(p.value, 10);
    }
  }

  return {
    year: map.year ?? date.getUTCFullYear(),
    month: map.month ?? (date.getUTCMonth() + 1),
    day: map.day ?? date.getUTCDate(),
    hour: map.hour ?? date.getUTCHours(),
    minute: map.minute ?? date.getUTCMinutes(),
  };
}

function createDateInTz(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const localParts = getZonedParts(utcGuess, timeZone);
  const localAsUtc = new Date(Date.UTC(localParts.year, localParts.month - 1, localParts.day, localParts.hour, localParts.minute, 0, 0));
  const offsetMs = localAsUtc.getTime() - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

/**
 * Returns today's calendar date as "YYYY-MM-DD" in the given timezone.
 */
export function getTodayDateStringInTz(timeZone: string = 'Africa/Casablanca'): string {
  const tz = isValidTimezone(timeZone) ? timeZone : 'Africa/Casablanca';
  const parts = getZonedParts(new Date(), tz);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Validates that a schedule's selected date and time have not already passed
 * in the configured timezone.
 * Returns { isValid: true, scheduledDate } or { isValid: false, error: string, scheduledDate }.
 */
export function validateScheduleNotPassed(
  rawScheduleConfig: ScheduleConfig | string,
  now: Date = new Date()
): { isValid: boolean; error?: string; scheduledDate: Date } {
  let cfg: ScheduleConfig = {};
  if (typeof rawScheduleConfig === 'string') {
    try {
      cfg = JSON.parse(rawScheduleConfig || '{}');
    } catch {
      cfg = {};
    }
  } else if (rawScheduleConfig && typeof rawScheduleConfig === 'object') {
    cfg = rawScheduleConfig;
  }

  const tz = isValidTimezone(cfg.timezone) ? cfg.timezone! : 'Africa/Casablanca';
  const { hour, minute } = parseScheduleTime(cfg.time || '09:00');

  const nowParts = getZonedParts(now, tz);
  let year = nowParts.year;
  let month = nowParts.month;
  let day = nowParts.day;

  if (cfg.startDate) {
    const [sY, sM, sD] = cfg.startDate.split('-').map(Number);
    if (sY && sM && sD) {
      year = sY;
      month = sM;
      day = sD;
    }
  }

  let scheduledDate = createDateInTz(year, month, day, hour, minute, tz);

  const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const zonedTodayStr = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`;
  const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const utcTodayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

  const targetMinutes = hour * 60 + minute;
  const zonedMinutes = nowParts.hour * 60 + nowParts.minute;
  const localMinutes = now.getHours() * 60 + now.getMinutes();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  // 1. If target date is strictly in the past across all timezone reference frames:
  if (targetDateStr < zonedTodayStr && targetDateStr < localTodayStr && targetDateStr < utcTodayStr) {
    return {
      isValid: false,
      error: 'This date and time has already passed. Please choose a future date and time.',
      scheduledDate,
    };
  }

  // 2. If target date is today in any reference frame:
  const isToday = targetDateStr === zonedTodayStr || targetDateStr === localTodayStr || targetDateStr === utcTodayStr;
  if (isToday) {
    // For Africa/Casablanca or environments where local Windows display clock differs by 1 hour from IANA tzdb (UTC+0 vs UTC+1),
    // a time today is valid if it is future relative to any of the valid reference frames (with 60-second grace window).
    const isFutureInZoned = targetMinutes + 1 >= zonedMinutes;
    const isFutureInLocal = targetMinutes + 1 >= localMinutes;
    const isFutureInUtc = targetMinutes + 1 >= utcMinutes;

    if (!isFutureInZoned && !isFutureInLocal && !isFutureInUtc) {
      return {
        isValid: false,
        error: 'This date and time has already passed. Please choose a future date and time.',
        scheduledDate,
      };
    }

    // Ensure scheduledDate is strictly in the future relative to now
    if (scheduledDate.getTime() <= now.getTime()) {
      const candidateUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
      if (candidateUtc.getTime() > now.getTime()) {
        scheduledDate = candidateUtc;
      } else {
        scheduledDate = new Date(now.getTime() + 60000);
      }
    }
  }

  return { isValid: true, scheduledDate };
}


/**
 * Scan for and recover stale RUNNING runs that exceeded execution timeout
 * (e.g. from server restarts, uncaught worker termination).
 */
export async function recoverStaleRuns(maxAgeMinutes: number = 20): Promise<number> {
  const { db } = await import('@/lib/db');
  const threshold = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  const staleRuns = await db.automationRun.findMany({
    where: {
      status: 'RUNNING',
      startedAt: { lte: threshold },
    },
    select: { id: true, automationId: true, logsJson: true },
  });

  if (staleRuns.length === 0) return 0;

  for (const run of staleRuns) {
    let logs: any[] = [];
    try {
      logs = JSON.parse(run.logsJson || '[]');
    } catch {}
    logs.push({
      timestamp: new Date().toISOString(),
      step: 'RECOVERY',
      message: `Execution timed out or worker process terminated unexpectedly after ${maxAgeMinutes}m. Marked as FAILED.`,
      level: 'error',
    });

    await db.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorMessage: 'Worker process terminated or run timed out (Server restart recovery)',
        failedStep: 'EXECUTION',
        logsJson: JSON.stringify(logs),
      },
    });

    await db.automation.update({
      where: { id: run.automationId },
      data: { failedRuns: { increment: 1 } },
    }).catch(() => {});
  }

  return staleRuns.length;
}

/**
 * Calculate the exact UTC start and end bounds of a calendar day in a specific timezone.
 */
export function getDayBoundsInTz(
  date: Date = new Date(),
  timeZone: string = 'UTC'
): { start: Date; end: Date; startOfDay: Date; endOfDay: Date } {
  const tz = isValidTimezone(timeZone) ? timeZone : 'UTC';
  const parts = getZonedParts(date, tz);
  const startOfDay = createDateInTz(parts.year, parts.month, parts.day, 0, 0, tz);
  // End of day is start of next day minus 1 millisecond
  const nextDayStart = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const endOfDay = new Date(nextDayStart.getTime() - 1);
  return { start: startOfDay, end: endOfDay, startOfDay, endOfDay };
}

export interface AutomationDailyStats {
  dailyTarget: number;
  completedToday: number;
  failedToday: number;
  remainingToday: number;
  timezone: string;
  startOfDay: Date;
  endOfDay: Date;
}

/**
 * Calculate real daily article counters for an automation.
 * Strictly verifies persisted articles: only counts COMPLETED runs with a valid generatedArticleId.
 */
export async function getAutomationDailyStats(
  automationId: string,
  rawScheduleConfig: ScheduleConfig | string,
  targetDate: Date = new Date()
): Promise<AutomationDailyStats> {
  const { db } = await import('@/lib/db');
  let cfg: ScheduleConfig = {};
  if (typeof rawScheduleConfig === 'string') {
    try {
      cfg = JSON.parse(rawScheduleConfig || '{}');
    } catch {
      cfg = {};
    }
  } else if (rawScheduleConfig && typeof rawScheduleConfig === 'object') {
    cfg = rawScheduleConfig;
  }

  const timezone = isValidTimezone(cfg.timezone) ? cfg.timezone! : 'UTC';
  const dailyTarget = Math.max(1, Number(cfg.articlesPerDay) || 1);
  const { startOfDay, endOfDay } = getDayBoundsInTz(targetDate, timezone);

  // Completed articles today: must be COMPLETED and have generatedArticleId
  const completedToday = await db.automationRun.count({
    where: {
      automationId,
      status: 'COMPLETED',
      generatedArticleId: { not: null },
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  // Failed runs today
  const failedToday = await db.automationRun.count({
    where: {
      automationId,
      status: 'FAILED',
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  const remainingToday = Math.max(0, dailyTarget - completedToday);

  return {
    dailyTarget,
    completedToday,
    failedToday,
    remainingToday,
    timezone,
    startOfDay,
    endOfDay,
  };
}
