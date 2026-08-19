'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeChat } from '@/lib/ai/ai-service';
import type { ChatMessage } from '@/lib/ai/ai-service';
import { z } from 'zod/v4';

function reqId() {
  return 'req_' + crypto.randomUUID().slice(0, 8);
}

function err(message: string, status = 400, code = 'VALIDATION_ERROR') {
  return NextResponse.json(
    { error: { code, message }, meta: { requestId: reqId(), timestamp: new Date().toISOString() } },
    { status },
  );
}

const schema = z.object({
  text: z.string().min(1, 'Selected text is required'),
  action: z.string().min(1, 'Action is required'),
  context: z.string().optional().or(z.literal('')),
});

// =====================================================================
// POST — edit a selected text snippet with AI
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err('Request body must be valid JSON');
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const { text, action, context } = parsed.data;

    // Find an active AI provider
    const provider = await db.aiProvider.findFirst({
      where: { isActive: true, isDefault: true, apiKeyEncrypted: { not: null } },
      include: { models: true },
    });

    if (!provider) {
      const fallback = await db.aiProvider.findFirst({
        where: { isActive: true, apiKeyEncrypted: { not: null } },
        include: { models: true },
      });
      if (!fallback) {
        return err('No active AI provider configured. Please set up an AI provider in Settings > AI.', 400, 'NO_PROVIDER');
      }
    }

    const activeProvider = provider!;

    const systemPrompt = `You are a professional text editor. The user has selected a portion of text from their document and wants you to apply a specific editing action to it.

Rules:
- Return ONLY the modified text, nothing else.
- Do NOT wrap the result in markdown code blocks.
- Do NOT add explanations, prefixes, or suffixes.
- Preserve the original formatting (bold, italic, links, etc.) when possible by using the same HTML tags.
- If the action is ambiguous, make a reasonable best-effort edit.
- If the action cannot be applied (e.g., "Add a conclusion" on a single word), improve the text in the spirit of the action.
- Output plain text by default. Only use HTML tags if the input text contains HTML tags.`;

    const userPrompt = `Selected text:
"""
${text}
"""

Action: ${action}
${context ? `\nContext (surrounding content for reference):\n"""\n${context}\n"""` : ''}

Apply the action to the selected text and return ONLY the modified text.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = await executeChat({
      providerId: activeProvider.id,
      messages,
      temperature: 0.5,
      maxTokens: 4000,
    });

    // Strip markdown code block wrappers if present
    let editedText = result.content.trim();
    if (editedText.startsWith('```')) {
      editedText = editedText.replace(/^```(?:html|text)?\n?/, '').replace(/\n?```$/, '');
    }

    return NextResponse.json({
      data: { editedText },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to edit text';
    console.error(`[CONTENT/AI-EDIT-SELECTION] ${id} —`, error);
    return err(msg, 500, 'AI_ERROR');
  }
}
