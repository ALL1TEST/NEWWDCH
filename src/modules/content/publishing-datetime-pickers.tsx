'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// ==========================================
// 1. DATE PICKER (Matches Image 1)
// ==========================================

interface PublishDatePickerProps {
  value: string; // YYYY-MM-DD or ISO
  onChange: (dateStr: string) => void;
  className?: string;
}

export function PublishDatePicker({ value, onChange, className }: PublishDatePickerProps) {
  const [open, setOpen] = useState(false);

  // Parse initial date
  const parsedDate = useMemo(() => {
    if (!value) return null;
    const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const [viewYear, setViewYear] = useState(() => (parsedDate || new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (parsedDate || new Date()).getMonth());

  // Sync view when value changes
  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.getFullYear());
      setViewMonth(parsedDate.getMonth());
    }
  }, [parsedDate]);

  const monthName = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [viewYear, viewMonth]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar matrix calculation
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateStr: string;
    }> = [];

    // Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, month: prevMonth, year: prevYear, isCurrentMonth: false, dateStr });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true, dateStr });
    }

    // Next month leading days (to fill 35 or 42 grid cells)
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, month: nextMonth, year: nextYear, isCurrentMonth: false, dateStr });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const selectedDateStr = useMemo(() => {
    if (!parsedDate) return '';
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [parsedDate]);

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const displayDateText = useMemo(() => {
    if (!parsedDate) return '--/--/----';
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    const y = parsedDate.getFullYear();
    return `${m}/${d}/${y}`;
  }, [parsedDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center justify-between h-10 px-3 w-full rounded-md border border-input bg-transparent hover:bg-muted/10 transition-colors text-sm font-normal shadow-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring text-left',
            className,
          )}
        >
          <span className={cn('truncate flex-1', !parsedDate ? 'text-muted-foreground' : 'text-foreground')}>
            {displayDateText}
          </span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[264px] p-3 rounded-2xl border border-border/80 bg-popover shadow-xl select-none z-[200]"
      >
        {/* Month Header (matches Image 1: < September 2026 >) */}
        <div className="flex items-center justify-between pb-3 px-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-semibold text-sm text-foreground">{monthName}</span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Days of week header (Su Mo Tu We Th Fr Sa) */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-normal text-muted-foreground pb-2">
          <span>Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {calendarCells.map((cell, idx) => {
            const isSelected = cell.dateStr === selectedDateStr;
            const isToday = cell.dateStr === todayStr;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onChange(cell.dateStr);
                  setOpen(false);
                }}
                className={cn(
                  'h-8 w-8 text-xs flex items-center justify-center rounded-full transition-all cursor-pointer mx-auto',
                  isSelected
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs'
                    : isToday
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-foreground font-medium'
                    : cell.isCurrentMonth
                    ? 'text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    : 'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60',
                )}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ==========================================
// 2. TIME PICKER (Matches Image 2 & User Request: Black Active Color, not sticking to right)
// ==========================================

interface PublishTimePickerProps {
  value: string; // HH:mm (24h)
  onChange: (timeStr: string) => void;
  className?: string;
}

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'] as const;

export function PublishTimePicker({ value, onChange, className }: PublishTimePickerProps) {
  const [open, setOpen] = useState(false);

  // Parse 24h value to 12h + period
  const { hour12, minute, period } = useMemo(() => {
    if (!value) {
      const now = new Date();
      const h24 = now.getHours();
      const m = now.getMinutes();
      const p = h24 >= 12 ? 'PM' : 'AM';
      const h12 = (h24 % 12 || 12).toString().padStart(2, '0');
      return { hour12: h12, minute: String(m).padStart(2, '0'), period: p };
    }
    const [hStr, mStr] = value.split(':');
    const hNum = parseInt(hStr || '10', 10);
    const mNum = parseInt(mStr || '00', 10);
    const p = hNum >= 12 ? 'PM' : 'AM';
    const h12 = (hNum % 12 || 12).toString().padStart(2, '0');
    return {
      hour12: h12,
      minute: (isNaN(mNum) ? 0 : mNum).toString().padStart(2, '0'),
      period: p,
    };
  }, [value]);

  const updateTime = (newH12: string, newMin: string, newPeriod: 'AM' | 'PM') => {
    let h = parseInt(newH12, 10);
    if (newPeriod === 'PM' && h < 12) h += 12;
    if (newPeriod === 'AM' && h === 12) h = 0;
    const final24 = `${String(h).padStart(2, '0')}:${newMin}`;
    onChange(final24);
  };

  const displayText = useMemo(() => {
    if (!value) return '--:-- --';
    return `${hour12}:${minute} ${period}`;
  }, [value, hour12, minute, period]);

  // Refs for scrolling to selected item
  const hourListRef = useRef<HTMLDivElement>(null);
  const minListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const hourEl = hourListRef.current;
    const minEl = minListRef.current;

    const onWheelScroll = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      if (target) {
        target.scrollTop += e.deltaY;
      }
    };

    if (hourEl) {
      hourEl.addEventListener('wheel', onWheelScroll, { passive: false });
    }
    if (minEl) {
      minEl.addEventListener('wheel', onWheelScroll, { passive: false });
    }

    const timer = setTimeout(() => {
      if (hourEl) {
        const selected = hourEl.querySelector('[data-selected="true"]') as HTMLElement;
        if (selected) {
          hourEl.scrollTop = selected.offsetTop - 40;
        }
      }
      if (minEl) {
        const selected = minEl.querySelector('[data-selected="true"]') as HTMLElement;
        if (selected) {
          minEl.scrollTop = selected.offsetTop - 40;
        }
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      if (hourEl) {
        hourEl.removeEventListener('wheel', onWheelScroll);
      }
      if (minEl) {
        minEl.removeEventListener('wheel', onWheelScroll);
      }
    };
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center justify-between h-10 px-3 w-full rounded-md border border-input bg-transparent hover:bg-muted/10 transition-colors text-sm font-normal shadow-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring text-left',
            className,
          )}
        >
          <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{displayText}</span>
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        data-scroll-locked=""
        data-radix-scroll-lock-ignore=""
        className="w-auto p-2.5 rounded-xl border border-border/80 bg-popover shadow-xl select-none z-[200]"
      >
        <div className="flex items-start gap-1" data-scroll-locked="" data-radix-scroll-lock-ignore="">
          {/* Column 1: Hours (matches Image 2 with black active color) */}
          <div
            ref={hourListRef}
            data-scroll-locked=""
            data-radix-scroll-lock-ignore=""
            onWheel={(e) => {
              e.stopPropagation();
              e.currentTarget.scrollTop += e.deltaY;
            }}
            className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1 scrollbar-thin select-none"
            style={{ overscrollBehavior: 'contain' }}
          >
            {HOURS.map((h) => {
              const isSelected = h === hour12;
              return (
                <button
                  key={h}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => updateTime(h, minute, period as any)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors text-center cursor-pointer',
                    isSelected
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-xs'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  {h}
                </button>
              );
            })}
          </div>

          {/* Column 2: Minutes (matches Image 2 with black active color) */}
          <div
            ref={minListRef}
            data-scroll-locked=""
            data-radix-scroll-lock-ignore=""
            onWheel={(e) => {
              e.stopPropagation();
              e.currentTarget.scrollTop += e.deltaY;
            }}
            className="flex flex-col gap-1 max-h-56 overflow-y-auto px-1 border-x border-border/60 scrollbar-thin select-none"
            style={{ overscrollBehavior: 'contain' }}
          >
            {MINUTES.map((m) => {
              const isSelected = m === minute;
              return (
                <button
                  key={m}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => updateTime(hour12, m, period as any)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors text-center cursor-pointer',
                    isSelected
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-xs'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {/* Column 3: AM / PM (matches Image 2 with black active color) */}
          <div className="flex flex-col gap-1 pl-1">
            {PERIODS.map((p) => {
              const isSelected = p === period;
              return (
                <button
                  key={p}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => updateTime(hour12, minute, p)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors text-center cursor-pointer',
                    isSelected
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-xs'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
