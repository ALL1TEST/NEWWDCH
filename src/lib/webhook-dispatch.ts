// ============================================================
// WEBHOOK DISPATCH SERVICE — Triggers webhooks on CMS events
// ============================================================

import { db } from '@/lib/db';
import { createHmac, randomUUID } from 'crypto';

export type WebhookEventType =
  | 'content.created'
  | 'content.updated'
  | 'content.deleted'
  | 'media.uploaded'
  | 'user.created'
  | 'comment.created'
  | 'form.submitted';

interface DispatchOptions {
  event: WebhookEventType | string;
  siteId?: string;
  data: Record<string, unknown>;
}

interface DispatchResult {
  triggered: number;
  failures: number;
}

/**
 * Dispatch webhooks for a given event.
 * Finds all active webhooks matching the event + site, and sends them.
 * This is fire-and-forget — callers should NOT await this in critical paths.
 */
export async function dispatchWebhooks(options: DispatchOptions): Promise<DispatchResult> {
  const { event, siteId, data } = options;

  let triggered = 0;
  let failures = 0;

  try {
    // Find matching webhooks
    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (siteId) {
      where.OR = [
        { siteId },
        { scope: 'ALL_SITES' },
      ];
    } else {
      where.scope = 'ALL_SITES';
    }

    const webhooks = await db.webhook.findMany({ where });

    // Filter by event subscription
    const matching = webhooks.filter((w) => {
      try {
        const events: string[] = JSON.parse(w.events);
        return events.includes(event);
      } catch {
        return false;
      }
    });

    if (matching.length === 0) return { triggered: 0, failures: 0 };

    // Dispatch each webhook
    for (const webhook of matching) {
      try {
        await sendWebhook(webhook, event, data);
        triggered++;
      } catch (err) {
        console.error(`[WEBHOOK:DISPATCH] Failed to send webhook ${webhook.id}:`, err);
        failures++;
      }
    }
  } catch (error) {
    console.error('[WEBHOOK:DISPATCH] Error during dispatch:', error);
  }

  return { triggered, failures };
}

/**
 * Send a single webhook and record the delivery.
 */
async function sendWebhook(
  webhook: { id: string; name: string; url: string; secret: string | null; siteId: string | null; timeout: number; maxRetries: number },
  event: string,
  data: Record<string, unknown>,
) {
  const timestamp = Date.now();
  const payload = {
    event,
    id: randomUUID(),
    siteId: webhook.siteId,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadStr = JSON.stringify(payload);

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Id': webhook.id,
    'X-Webhook-Event': event,
    'X-Webhook-Timestamp': String(timestamp),
  };

  // Sign with HMAC-SHA256
  if (webhook.secret) {
    const signature = createHmac('sha256', webhook.secret)
      .update(`${timestamp}.${payloadStr}`)
      .digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  const startTime = Date.now();
  let statusCode: number | null = null;
  let responseStr: string | null = null;
  let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';
  let errorMessage: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), (webhook.timeout || 10) * 1000);

    const res = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = res.status;

    try {
      responseStr = await res.text();
      if (responseStr.length > 10000) {
        responseStr = responseStr.substring(0, 10000) + '...[truncated]';
      }
    } catch {
      responseStr = '(could not read response body)';
    }

    if (res.status >= 400) {
      status = 'FAILED';
      errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    }
  } catch (err) {
    status = 'FAILED';
    if (err instanceof DOMException && err.name === 'AbortError') {
      errorMessage = `Request timed out after ${webhook.timeout || 10}s`;
    } else {
      errorMessage = err instanceof Error ? err.message : 'Network error';
    }
    statusCode = null;
  }

  const duration = Date.now() - startTime;

  // Record delivery (fire-and-forget the DB write too)
  try {
    await db.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        webhookName: webhook.name,
        event,
        payload: payloadStr,
        requestHeaders: JSON.stringify(headers),
        response: responseStr,
        statusCode,
        status,
        attempts: 1,
        maxRetries: webhook.maxRetries || 3,
        duration,
        errorMessage,
        siteId: webhook.siteId,
        createdAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Update webhook stats
    await db.webhook.update({
      where: { id: webhook.id },
      data: {
        lastDeliveryAt: new Date(),
        lastStatusCode: statusCode,
        lastError: errorMessage,
        successCount: status === 'SUCCESS' ? { increment: 1 } : undefined,
        failureCount: status === 'FAILED' ? { increment: 1 } : undefined,
      },
    });
  } catch (dbErr) {
    console.error('[WEBHOOK:DISPATCH] Failed to record delivery:', dbErr);
  }
}

// ============================================================
// Convenience trigger functions — call these from API routes
// ============================================================

export function triggerContentCreated(siteId: string | undefined, contentData: Record<string, unknown>) {
  dispatchWebhooks({ event: 'content.created', siteId, data: contentData }).catch(() => {});
}

export function triggerContentUpdated(siteId: string | undefined, contentData: Record<string, unknown>) {
  dispatchWebhooks({ event: 'content.updated', siteId, data: contentData }).catch(() => {});
}

export function triggerContentDeleted(siteId: string | undefined, contentData: Record<string, unknown>) {
  dispatchWebhooks({ event: 'content.deleted', siteId, data: contentData }).catch(() => {});
}

export function triggerMediaUploaded(siteId: string | undefined, mediaData: Record<string, unknown>) {
  dispatchWebhooks({ event: 'media.uploaded', siteId, data: mediaData }).catch(() => {});
}

export function triggerUserCreated(userData: Record<string, unknown>) {
  dispatchWebhooks({ event: 'user.created', data: userData }).catch(() => {});
}

export function triggerCommentCreated(siteId: string | undefined, commentData: Record<string, unknown>) {
  dispatchWebhooks({ event: 'comment.created', siteId, data: commentData }).catch(() => {});
}

export function triggerFormSubmitted(siteId: string | undefined, formData: Record<string, unknown>) {
  dispatchWebhooks({ event: 'form.submitted', siteId, data: formData }).catch(() => {});
}
