'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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
// 2. TIME PICKER (Matches Month Calendar Style with Black Active State)
// ==========================================

export interface PublishTimePickerProps {
  value?: string; // HH:mm (24h)
  onChange?: (timeStr: string) => void;
  dateValue?: string; // Optional YYYY-MM-DD
  onDateChange?: (dateStr: string) => void;
  showDateInButton?: boolean;
  placeholder?: string;
  className?: string;
  showIcon?: boolean;
  showClear?: boolean;
  onClear?: () => void;
  id?: string;
}

export function PublishTimePicker({
  value = '',
  onChange,
  dateValue,
  onDateChange,
  showDateInButton = true,
  placeholder,
  className,
  showIcon,
  showClear,
  onClear,
  id,
}: PublishTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [hourOpen, setHourOpen] = useState(false);
  const [minuteOpen, setMinuteOpen] = useState(false);
  const hourContainerRef = useRef<HTMLDivElement>(null);
  const minuteContainerRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (dateValue) {
      const d = new Date(dateValue.includes('T') ? dateValue : `${dateValue}T12:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  useEffect(() => {
    if (dateValue) {
      const d = new Date(dateValue.includes('T') ? dateValue : `${dateValue}T12:00:00`);
      if (!isNaN(d.getTime())) setSelectedDate(d);
    }
  }, [dateValue]);

  // Parse 24h into 12h + period
  const { hour12, minute, period } = useMemo(() => {
    if (!value) {
      return { hour12: '12', minute: '00', period: 'PM' as const };
    }
    const [hStr, mStr] = value.split(':');
    const hNum = parseInt(hStr ?? '12', 10);
    const mNum = parseInt(mStr ?? '0', 10);
    const p = hNum >= 12 ? 'PM' : 'AM';
    const h12 = (hNum % 12 || 12).toString().padStart(2, '0');
    const m = (isNaN(mNum) ? 0 : mNum).toString().padStart(2, '0');
    return { hour12: h12, minute: m, period: p as 'AM' | 'PM' };
  }, [value]);

  const updateTime = (newH12: string, newMin: string, newPeriod: 'AM' | 'PM') => {
    let h = parseInt(newH12, 10);
    if (newPeriod === 'PM' && h < 12) h += 12;
    if (newPeriod === 'AM' && h === 12) h = 0;
    const final24 = `${String(h).padStart(2, '0')}:${newMin.padStart(2, '0')}`;
    if (onChange) onChange(final24);
  };

  const displayText = useMemo(() => {
    if (!showDateInButton) {
      if (value) return `${hour12}:${minute} ${period}`;
      return placeholder || '--:-- --';
    }

    let datePart = '';
    if (dateValue) {
      const d = new Date(dateValue.includes('T') ? dateValue : `${dateValue}T12:00:00`);
      if (!isNaN(d.getTime())) {
        datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    if (datePart && value) {
      return `${datePart} at ${hour12}:${minute} ${period}`;
    }
    if (datePart && !value) {
      return datePart;
    }
    if (value) {
      return `${hour12}:${minute} ${period}`;
    }
    return placeholder || '--:-- --';
  }, [value, hour12, minute, period, dateValue, placeholder, showDateInButton]);

  // Auto scroll to active number on open
  useEffect(() => {
    if (!hourOpen) return;
    const timer = setTimeout(() => {
      const container = hourContainerRef.current;
      if (!container) return;
      const selected = container.querySelector('[data-selected="true"]') as HTMLElement | null;
      if (selected) {
        container.scrollTop = selected.offsetTop - container.clientHeight / 2 + selected.clientHeight / 2;
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [hourOpen]);

  useEffect(() => {
    if (!minuteOpen) return;
    const timer = setTimeout(() => {
      const container = minuteContainerRef.current;
      if (!container) return;
      const selected = container.querySelector('[data-selected="true"]') as HTMLElement | null;
      if (selected) {
        container.scrollTop = selected.offsetTop - container.clientHeight / 2 + selected.clientHeight / 2;
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [minuteOpen]);

  const shouldShowIcon = showIcon ?? (dateValue !== undefined || Boolean(placeholder));
  const hasValue = Boolean(value || dateValue);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            'flex items-center justify-between h-10 px-3 w-[260px] rounded-md border border-input bg-transparent hover:bg-muted/10 transition-colors text-xs shadow-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring text-left',
            className,
          )}
        >
          <div className="flex items-center gap-2 truncate flex-1 mr-2">
            {shouldShowIcon && <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span
              className={cn(
                'truncate',
                hasValue ? 'text-foreground font-semibold font-mono' : 'text-muted-foreground font-normal',
              )}
            >
              {displayText}
            </span>
          </div>
          {showClear && hasValue && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                if (onClear) {
                  onClear();
                } else {
                  if (onChange) onChange('');
                  if (onDateChange) onDateChange('');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  if (onClear) onClear();
                }
              }}
              className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 transition-colors"
              aria-label="clear date and time"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-auto p-3 rounded-2xl border border-border/80 bg-popover shadow-xl select-none z-[200]"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            if (d) {
              setSelectedDate(d);
              if (onDateChange) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                onDateChange(`${y}-${m}-${day}`);
              }
              if (!value && onChange) {
                onChange('12:00');
              }
            }
          }}
          initialFocus
        />
        {/* Time Selector matching Calendar Month styling (no blue, rounded-2xl border matching big month card) */}
        <div className="border-t border-border/60 pt-2.5 mt-2 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0 mr-1" />

            {/* Custom Hour Picker */}
            <Popover open={hourOpen} onOpenChange={setHourOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'h-8 px-2.5 rounded-lg border border-input bg-background hover:bg-muted/40 font-mono text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer',
                    hourOpen && 'border-neutral-900 ring-1 ring-neutral-900',
                  )}
                >
                  <span>{hour12}</span>
                  <ChevronDown
                    className={cn('h-3 w-3 text-muted-foreground transition-transform', hourOpen && 'rotate-180')}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={6}
                className="w-20 p-1.5 rounded-2xl border border-border/80 bg-popover shadow-xl z-[250] select-none"
              >
                <div
                  ref={hourContainerRef}
                  data-radix-scroll-lock-ignore=""
                  onWheel={(e) => {
                    e.stopPropagation();
                    if (hourContainerRef.current) {
                      hourContainerRef.current.scrollTop += e.deltaY;
                    }
                  }}
                  style={{ maxHeight: '180px', overscrollBehavior: 'contain' }}
                  className="overflow-y-auto flex flex-col gap-0.5 scrollbar-thin"
                >
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => {
                    const isSelected = h === hour12;
                    return (
                      <button
                        key={h}
                        type="button"
                        data-selected={isSelected}
                        onClick={() => {
                          updateTime(h, minute, period);
                          setHourOpen(false);
                        }}
                        className={cn(
                          'h-7 text-xs font-mono font-medium rounded-lg transition-colors text-center cursor-pointer',
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
              </PopoverContent>
            </Popover>

            <span className="font-bold text-muted-foreground text-xs">:</span>

            {/* Custom Minute Picker */}
            <Popover open={minuteOpen} onOpenChange={setMinuteOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'h-8 px-2.5 rounded-lg border border-input bg-background hover:bg-muted/40 font-mono text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer',
                    minuteOpen && 'border-neutral-900 ring-1 ring-neutral-900',
                  )}
                >
                  <span>{minute}</span>
                  <ChevronDown
                    className={cn('h-3 w-3 text-muted-foreground transition-transform', minuteOpen && 'rotate-180')}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={6}
                className="w-20 p-1.5 rounded-2xl border border-border/80 bg-popover shadow-xl z-[250] select-none"
              >
                <div
                  ref={minuteContainerRef}
                  data-radix-scroll-lock-ignore=""
                  onWheel={(e) => {
                    e.stopPropagation();
                    if (minuteContainerRef.current) {
                      minuteContainerRef.current.scrollTop += e.deltaY;
                    }
                  }}
                  style={{ maxHeight: '180px', overscrollBehavior: 'contain' }}
                  className="overflow-y-auto flex flex-col gap-0.5 scrollbar-thin"
                >
                  {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => {
                    const isSelected = m === minute;
                    return (
                      <button
                        key={m}
                        type="button"
                        data-selected={isSelected}
                        onClick={() => {
                          updateTime(hour12, m, period);
                          setMinuteOpen(false);
                        }}
                        className={cn(
                          'h-7 text-xs font-mono font-medium rounded-lg transition-colors text-center cursor-pointer',
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
              </PopoverContent>
            </Popover>
          </div>

          {/* AM / PM Segmented Control */}
          <div className="flex rounded-md border border-input p-0.5 bg-muted/30">
            <button
              type="button"
              onClick={() => updateTime(hour12, minute, 'AM')}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer',
                period === 'AM'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => updateTime(hour12, minute, 'PM')}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer',
                period === 'PM'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              PM
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
