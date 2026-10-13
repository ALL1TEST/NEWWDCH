// ============================================================
// POST /api/settings/smtp/test   — Verify SMTP connection
// Body: { settings?: SmtpConfigInput }
//   - Connects and verifies SMTP credentials without sending an email.
//   - Tests the current values from the form.
//   - Uses new password if provided, or decrypts saved password if masked.
// ============================================================
// ENTITLEMENT GATE — SMTP Settings is derived from Email Templates OR
// Newsletter: both dependents disabled → 403 FEATURE_NOT_AVAILABLE.
// Platform staff pass.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getSiteWhere } from '@/lib/site-context';
import { requireAnyFeatureAllowStaff } from '@/lib/platform/platform-auth';
import { SMTP_DEPENDENT_FEATURES } from '@/lib/platform/feature-config';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import {
  createSmtpTransport,
  type SmtpConfigInput,
} from '@/lib/smtp/transport';

function reqId() {
  return 'req_' + nanoid(8);
}

const bodySchema = z.object({
  settings: z
    .object({
      provider: z.string().optional(),
      host: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      encryption: z.enum(['none', 'SSL', 'STARTTLS']).optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      fromName: z.string().optional(),
      fromEmail: z.string().optional(),
      replyTo: z.string().optional(),
      timeout: z.number().int().min(1).max(120).optional(),
      isActive: z.boolean().optional(),
    })
    .optional(),
});

async function resolveSettings(
  settings: Partial<SmtpConfigInput> | undefined,
  siteFilter: Record<string, unknown>,
): Promise<SmtpConfigInput | null> {
  const where: Record<string, unknown> = { isDefault: true, ...siteFilter };
  let saved = await db.smtpSetting.findFirst({ where, orderBy: { updatedAt: 'desc' } });
  if (!saved && siteFilter.siteId) {
    saved = await db.smtpSetting.findFirst({
      where: { isDefault: true, siteId: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Determine password:
  // If settings provided a new, unmasked password, use that.
  // Otherwise, use saved DB password (decrypted).
  let password = settings?.password ?? '';
  const isMaskedOrEmpty = !password || password.includes('•');

  if (isMaskedOrEmpty) {
    if (saved?.password) {
      try {
        const decrypted = await decrypt(saved.password);
        password = decrypted || saved.password;
      } catch {
        password = saved.password;
      }
    }
  }

  if (!settings && !saved) {
    return null;
  }

  return {
    provider: settings?.provider ?? saved?.provider ?? 'SMTP',
    host: settings?.host ?? saved?.host ?? '',
    port: settings?.port ?? saved?.port ?? 587,
    encryption:
      (settings?.encryption as SmtpConfigInput['encryption'] | undefined) ??
      (saved?.encryption as SmtpConfigInput['encryption'] | undefined) ??
      'STARTTLS',
    username: settings?.username ?? saved?.username ?? '',
    password,
    fromName: settings?.fromName ?? saved?.fromName ?? '',
    fromEmail: settings?.fromEmail ?? saved?.fromEmail ?? '',
    replyTo: settings?.replyTo ?? saved?.replyTo ?? '',
    timeout: settings?.timeout ?? saved?.timeout ?? 10,
    isActive: settings?.isActive ?? saved?.isActive ?? true,
  };
}

export async function POST(request: NextRequest) {
  const id = reqId();

  const featureAuth = await requireAnyFeatureAllowStaff(request, [...SMTP_DEPENDENT_FEATURES]);
  if ('response' in featureAuth) return featureAuth.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const { settings } = parsed.data;
    const siteFilter = await getSiteWhere(request);
    const cfg = await resolveSettings(settings, siteFilter);

    if (!cfg || (!cfg.host && !cfg.username)) {
      return NextResponse.json(
        {
          error: {
            code: 'SMTP_NOT_CONFIGURED',
            message: 'No SMTP settings found. Please configure your SMTP host and credentials first.',
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    if (!cfg.host || !cfg.port) {
      return NextResponse.json(
        {
          error: {
            code: 'SMTP_INCOMPLETE',
            message: 'Host and port are required to test connection.',
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const transport = await createSmtpTransport(cfg);

    try {
      await transport.verify();
      return NextResponse.json({
        data: {
          success: true,
          message: 'SMTP connection verified successfully.',
        },
        meta: { requestId: id, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      let userFriendlyMessage = rawMessage;

      if (
        rawMessage.includes('Invalid login') ||
        rawMessage.includes('535') ||
        rawMessage.includes('BadCredentials')
      ) {
        userFriendlyMessage =
          'Authentication failed. Please verify your SMTP username and password (or App Password).';
      } else if (rawMessage.includes('ENOTFOUND')) {
        userFriendlyMessage = `SMTP host '${cfg.host}' could not be reached. Please check the hostname.`;
      } else if (
        rawMessage.includes('ETIMEDOUT') ||
        rawMessage.includes('ESOCKETTIMEDOUT')
      ) {
        userFriendlyMessage = `Connection timed out connecting to ${cfg.host}:${cfg.port}. Please check the port and firewall/network.`;
      } else if (rawMessage.includes('ECONNREFUSED')) {
        userFriendlyMessage = `Connection refused by ${cfg.host}:${cfg.port}. Please check the port and encryption mode.`;
      }

      return NextResponse.json(
        {
          error: {
            code: 'SMTP_TEST_FAILED',
            message: userFriendlyMessage,
          },
          meta: { requestId: id },
        },
        { status: 422 },
      );
    } finally {
      transport.close();
    }
  } catch (error) {
    console.error(`[SMTP_SETTINGS:TEST] ${id} —`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to test SMTP connection',
        },
        meta: { requestId: id },
      },
      { status: 500 },
    );
  }
}
