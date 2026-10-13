import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeChat } from '@/lib/ai/ai-service';
import {
  KARMAX_SUPPORT_SYSTEM_PROMPT,
  resolveSupportFallback,
} from '@/lib/support/support-knowledge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], locale = 'en' } = body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: { message: 'Message is required' } },
        { status: 400 },
      );
    }

    const trimmedMessage = message.trim();

    // 1. Try to utilize an active AI provider configured in the system (with a responsive 4.5s timeout)
    try {
      const activeProvider = await db.aiProvider.findFirst({
        where: {
          isActive: true,
          apiKeyEncrypted: { not: null },
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      });

      if (activeProvider) {
        const textModel = await db.aiModel.findFirst({
          where: {
            providerId: activeProvider.id,
            isActive: true,
            type: 'TEXT',
          },
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        });

        const chatMessages = [
          {
            role: 'system' as const,
            content: `${KARMAX_SUPPORT_SYSTEM_PROMPT}\n\nCurrent User Preferred Language/Locale: ${locale}`,
          },
          ...(Array.isArray(history) ? history.slice(-4) : []).map((h) => ({
            role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: String(h.content || ''),
          })),
          {
            role: 'user' as const,
            content: trimmedMessage,
          },
        ];

        const aiPromise = executeChat({
          providerId: activeProvider.id,
          modelId: textModel?.id,
          messages: chatMessages,
          temperature: 0.4,
          maxTokens: 1200,
        });

        // Responsive timeout: don't block the user if upstream provider is slow or unreachable
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 4000),
        );

        const aiResponse = await Promise.race([aiPromise, timeoutPromise]);

        if (aiResponse && aiResponse.content && aiResponse.content.trim()) {
          return NextResponse.json({
            data: {
              reply: aiResponse.content.trim(),
              source: 'ai',
            },
          });
        }
      }
    } catch (aiErr) {
      console.warn('[Support Chat] Dynamic AI error, using Knowledge Base fallback:', aiErr);
    }

    // 2. Fallback to the comprehensive Karmax SaaS Knowledge Engine
    const fallbackReply = resolveSupportFallback(trimmedMessage, locale);
    return NextResponse.json({
      data: {
        reply: fallbackReply,
        source: 'knowledge-base',
      },
    });
  } catch (error) {
    console.error('[Support Chat] Error handling support message:', error);
    const fallbackReply = resolveSupportFallback('help', 'en');
    return NextResponse.json({
      data: {
        reply: fallbackReply,
        source: 'fallback',
      },
    });
  }
}
