// ============================================================
// POST /api/email-templates/[id]/send-test — Send a test email (mock)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

// ---------- validation ------------------------------------------------

const sendTestSchema = z.object({
  email: z.string().email('A valid email address is required'),
  provider: z.string().max(50).trim().default('SMTP'),
});

// =====================================================================
// POST — send test (mock)
// =====================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: templateId } = await context.params;

    const template = await db.emailTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Email template not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = sendTestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;

    // Mock success — no actual email sending
    return NextResponse.json({
      data: {
        success: true,
        message: `Test email for "${template.name}" sent to ${d.email} via ${d.provider}`,
        templateId,
        testEmail: d.email,
        provider: d.provider,
        sentAt: new Date().toISOString(),
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:SEND_TEST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to send test email' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
