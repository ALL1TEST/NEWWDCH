// ============================================================
// POST /api/settings/smtp/test-email   — Send a test email
// Body: { email: string, settings?: SmtpConfigInput }
//   - Sends a styled HTML test email to the provided address.
//   - Password resolution mirrors /test route (use saved DB password
//     when the masked placeholder is submitted or no settings provided).
// ============================================================
// ENTITLEMENT GATE — SMTP Settings is derived from Email Templates OR
// Newsletter (never a plan checkbox): both dependents disabled → 403
// FEATURE_NOT_AVAILABLE. Platform staff pass (platform SMTP page).

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
  resolveFromAddress,
  type SmtpConfigInput,
} from '@/lib/smtp/transport';

// -------------------- helpers --------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const bodySchema = z.object({
  email: z.string().email('A valid recipient email is required'),
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
  siteFilter: Record<string, string>,
): Promise<SmtpConfigInput | null> {
  const where = { isDefault: true, ...siteFilter };
  const saved = await db.smtpSetting.findFirst({ where });

  if (!settings) {
    if (!saved) return null;
    let password = saved.password || '';
    if (password && /^[A-Za-z0-9+/=]+$/.test(password) && password.length >= 100) {
      try {
        password = await decrypt(password);
      } catch {
        // ignore
      }
    }
    return {
      provider: saved.provider,
      host: saved.host,
      port: saved.port,
      encryption: (saved.encryption as SmtpConfigInput['encryption']) || 'STARTTLS',
      username: saved.username,
      password,
      fromName: saved.fromName,
      fromEmail: saved.fromEmail,
      replyTo: saved.replyTo,
      timeout: saved.timeout,
      isActive: saved.isActive,
    };
  }

  let password = settings.password ?? '';
  if (password.includes('•')) {
    if (!saved) return null;
    password = saved.password || '';
    if (password && /^[A-Za-z0-9+/=]+$/.test(password) && password.length >= 100) {
      try {
        password = await decrypt(password);
      } catch {
        // ignore
      }
    }
  }

  return {
    provider: settings.provider ?? 'SMTP',
    host: settings.host ?? saved?.host ?? '',
    port: settings.port ?? saved?.port ?? 587,
    encryption:
      (settings.encryption as SmtpConfigInput['encryption'] | undefined) ??
      (saved?.encryption as SmtpConfigInput['encryption'] | undefined) ??
      'STARTTLS',
    username: settings.username ?? saved?.username ?? '',
    password,
    fromName: settings.fromName ?? saved?.fromName ?? '',
    fromEmail: settings.fromEmail ?? saved?.fromEmail ?? '',
    replyTo: settings.replyTo ?? saved?.replyTo ?? '',
    timeout: settings.timeout ?? saved?.timeout ?? 10,
    isActive: settings.isActive ?? saved?.isActive ?? true,
  };
}

// -------------------- POST --------------------

export async function POST(request: NextRequest) {
  const id = reqId();

  // SMTP Settings derived-entitlement gate (Email Templates OR Newsletter).
  const featureAuth = await requireAnyFeatureAllowStaff(request, [...SMTP_DEPENDENT_FEATURES]);
  if ('response' in featureAuth) return featureAuth.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
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

    const { email, settings } = parsed.data;
    const siteFilter = await getSiteWhere(request);
    const cfg = await resolveSettings(settings, siteFilter);

    if (!cfg) {
      return NextResponse.json(
        {
          error: {
            code: 'SMTP_NOT_CONFIGURED',
            message:
              'No SMTP settings found. Please configure and save your SMTP settings first.',
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
            message: 'Host and port are required to send a test email.',
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const from = resolveFromAddress(cfg);
    if (!from || !cfg.fromEmail) {
      return NextResponse.json(
        {
          error: {
            code: 'SMTP_FROM_REQUIRED',
            message:
              'From Name and From Email are required before sending a test email.',
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const transport = await createSmtpTransport(cfg);

    const subject = 'CMS Test Email — SMTP Configuration Verified';
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;width:40px;height:40px;border-radius:8px;background:#0f172a;color:#ffffff;font-weight:700;line-height:40px;font-size:18px;">C</div>
          <h1 style="margin:12px 0 4px;font-size:20px;font-weight:600;color:#0f172a;">SMTP Test Email</h1>
          <p style="margin:0;color:#64748b;font-size:13px;">Your email delivery is configured correctly.</p>
        </div>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="color:#334155;font-size:14px;line-height:1.6;">Hello,</p>
        <p style="color:#334155;font-size:14px;line-height:1.6;">This is a confirmation that your SMTP settings are working. The email was delivered successfully from your CMS instance.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
          <tr><td style="padding:8px 0;color:#64748b;width:140px;">SMTP Host</td><td style="padding:8px 0;color:#0f172a;font-weight:500;">${escapeHtml(cfg.host)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Port</td><td style="padding:8px 0;color:#0f172a;font-weight:500;">${cfg.port}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Encryption</td><td style="padding:8px 0;color:#0f172a;font-weight:500;">${escapeHtml(cfg.encryption)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">From</td><td style="padding:8px 0;color:#0f172a;font-weight:500;">${escapeHtml(from)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Sent At</td><td style="padding:8px 0;color:#0f172a;font-weight:500;">${new Date().toISOString()}</td></tr>
        </table>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">This message was sent as part of an SMTP configuration test from your CMS admin panel. If you did not initiate this test, please contact your administrator.</p>
      </div>
    `;

    try {
      const info = await transport.sendMail({
        from,
        to: email,
        subject,
        html,
        replyTo: cfg.replyTo || undefined,
      });

      return NextResponse.json({
        data: {
          success: true,
          message: `Test email sent successfully to ${email}.`,
          messageId: info.messageId,
        },
        meta: { requestId: id, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          error: {
            code: 'SMTP_SEND_FAILED',
            message: `Failed to send test email: ${message}`,
          },
          meta: { requestId: id },
        },
        { status: 422 },
      );
    } finally {
      transport.close();
    }
  } catch (error) {
    console.error(`[SMTP_SETTINGS:TEST_EMAIL] ${id} —`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send test email',
        },
        meta: { requestId: id },
      },
      { status: 500 },
    );
  }
}

// -------------------- utils --------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
