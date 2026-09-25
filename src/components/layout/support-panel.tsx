'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  CircleHelp,
  ShieldCheck,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSupportPanelStore } from '@/lib/stores/support-panel-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useLocaleStore, useT } from '@/lib/i18n';

// ============================================================
// HELP / SUPPORT SIDE PANEL
// ============================================================
// Right-side support drawer opened from the account menu's
// "Help" action (see user-profile-menu.tsx). Mounted ONCE in
// AdminShell next to the CommandPalette and driven by the same
// global-store pattern (support-panel-store), so any dashboard
// surface can open it without prop-drilling.
//
// HONESTY CONTRACT (mirrors the marketing Contact page): the
// product has NO live support backend today, so this panel is a
// support EXPERIENCE, not a fake assistant —
//   • the greeting + suggested questions are static UI;
//   • a suggestion chip only fills the input (nothing is sent);
//   • sending appends the message locally and answers with ONE
//     honest notice explaining that live replies aren't
//     connected yet (no invented support agent, no fake email,
//     no pretended AI). When a real support/AI backend lands,
//     replace the local echo in handleSend with the API call.
//
// Navigation: the "Privacy" action routes to the dashboard's
// native Privacy Policy module (#/privacy — see
// modules/legal/privacy-page.tsx) and closes the panel.
// ============================================================

// A suggested quick-help question (its i18n key).
interface SupportSuggestion {
  key: string;
}

const SUGGESTIONS: SupportSuggestion[] = [
  { key: 'support.suggestion1' },
  { key: 'support.suggestion2' },
  { key: 'support.suggestion3' },
  { key: 'support.suggestion4' },
  { key: 'support.suggestion5' },
];

// One conversation turn. `from: 'assistant'` renders as a
// left-aligned muted bubble, `from: 'user'` as a right-aligned
// primary bubble — matching the dashboard's monochrome surfaces.
interface SupportMessage {
  id: number;
  from: 'assistant' | 'user';
  text: string;
}

export function SupportPanel() {
  const isOpen = useSupportPanelStore((s) => s.isOpen);
  const closePanel = useSupportPanelStore((s) => s.close);
  const navigate = useNavigationStore((s) => s.navigate);
  const locale = useLocaleStore((s) => s.locale);
  const { t } = useT();

  // Local conversation state — the greeting is the FIRST
  // assistant turn, so it is visible the moment the panel opens
  // (no message required). State lives inside the Sheet content:
  // Radix unmounts closed sheets, so every open starts a fresh
  // greeting + suggestions, and the local-only messages never
  // pretend to persist between sessions.
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const idRef = useRef(0);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Clear any pending auto-reply timer if the panel unmounts
  // mid-"conversation" (closed while the reply delay is running).
  useEffect(() => {
    return () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    };
  }, []);

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const now = new Date();
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  // Send: append the user's message locally, then — after a beat —
  // the single honest assistant notice. When a real support/AI
  // backend exists, this is the ONLY function that needs to
  // change (swap the timeout for the API call).
  const handleSend = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text) return;
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: ++idRef.current, from: 'user', text },
    ]);
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    replyTimerRef.current = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: ++idRef.current, from: 'assistant', text: t('support.autoReply') },
      ]);
    }, 450);
  };

  // A suggestion chip only FILLS the input — an honest UI
  // suggestion. Nothing is sent until the user presses send.
  const handleSuggestion = (question: string) => {
    setInput(question);
    // Focus the input so the next Enter/click actually sends it.
    requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector<HTMLInputElement>('input[data-support-input]')
        ?.focus();
    });
  };

  // Privacy → the dashboard's native Privacy Policy page. Close
  // the panel so the destination is immediately visible.
  const handlePrivacy = () => {
    closePanel();
    navigate('privacy');
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (!o ? closePanel() : undefined)}>
      <SheetContent
        side="right"
        // 440px on desktop (spec: 420–480), full width on mobile.
        // p-0/gap-0: the panel manages its own header/body/footer
        // padding so the borders run edge to edge. rounded-l-xl +
        // shadow-xl: the floating-panel treatment on the left edge
        // while staying flush right. z-[60] keeps the panel above
        // sticky headers (z-40/50) exactly like the profile
        // dropdown, so nothing overlaps the conversation.
        className="z-[60] flex w-full flex-col gap-0 p-0 sm:max-w-[440px] rounded-l-xl border-l shadow-xl"
        aria-label={t('support.title')}
      >
        {/* ---------- Header ---------- */}
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              <CircleHelp className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <SheetTitle className="text-base font-semibold leading-none">
                {t('support.title')}
              </SheetTitle>
              <SheetDescription className="text-xs leading-none text-muted-foreground">
                {t('support.subtitle')}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ---------- Conversation ---------- */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-5"
          role="log"
          aria-live="polite"
          aria-label={t('support.subtitle')}
        >
          {/* Timestamp divider — small, centered, muted (reference
              structure: a light time marker above the greeting). */}
          <p className="mb-4 text-center text-[11px] font-medium text-muted-foreground">
            {t('support.today')} · {timeLabel}
          </p>

          {/* Default greeting — an assistant bubble, visible
              immediately (before any message is sent). */}
          <div className="flex">
            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
              {t('support.greeting')}
            </div>
          </div>

          {/* Quick-help suggestions — UI only. Filling the input is
              the honest behavior: no fake answers, no pretended
              backend. Chips hide once the user has messages, so the
              conversation stays the focus. */}
          {messages.length === 0 && (
            <div
              className="mt-4 flex flex-wrap gap-2"
              role="group"
              aria-label={t('support.suggestionsLabel')}
            >
              {SUGGESTIONS.map(({ key }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSuggestion(t(key))}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          )}

          {/* Conversation turns (local echo + honest notice). */}
          <div className="mt-4 flex flex-col gap-3">
            {messages.map((m) =>
              m.from === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
                    {m.text}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* ---------- Footer: Privacy + composer ---------- */}
        <div className="border-t border-border px-5 pb-4 pt-3">
          {/* Privacy — sits directly below the conversation area,
              above the composer. Routes to Karmax's own Privacy
              Policy page (never an external link). */}
          <button
            type="button"
            onClick={handlePrivacy}
            className="mb-3 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('support.privacy')}
          </button>

          {/* Composer — pinned at the panel bottom (the footer is
              outside the scroll area), so the input stays reachable
              at any scroll position. Enter sends; the circular
              arrow button mirrors modern chat composers. */}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <Input
              data-support-input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('support.inputPlaceholder')}
              className="h-10 flex-1 rounded-full border-border bg-background px-4 text-sm focus-visible:ring-ring focus-visible:ring-offset-0"
              aria-label={t('support.inputPlaceholder')}
              autoComplete="off"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              aria-label={t('support.send')}
              className={cn(
                'h-10 w-10 shrink-0 rounded-full',
                !input.trim() && 'opacity-50',
              )}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
