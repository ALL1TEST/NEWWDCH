// ============================================================
// POST /api/webhook-deliveries/[id]/retry — Retry a failed delivery
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHmac } from 'crypto';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id: deliveryId } = await context.params;

    const delivery = await db.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });

    if (!delivery || !delivery.webhook) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Delivery or webhook not found' }, meta: { requestId: '' } },
        { status: 404 },
      );
    }

    const webhook = delivery.webhook;

    // Check max retries
    if (delivery.attempts >= delivery.maxRetries) {
      return NextResponse.json(
        { error: { code: 'MAX_RETRIES', message: 'Maximum retry count reached' }, meta: { requestId: '' } },
        { status: 400 },
      );
    }

    // Mark as retrying
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'RETRYING' },
    });

    const timestamp = Date.now();

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Id': webhook.id,
      'X-Webhook-Event': delivery.event,
      'X-Webhook-Timestamp': String(timestamp),
      'X-Webhook-Delivery-Id': delivery.id,
      'X-Webhook-Retry': String(delivery.attempts + 1),
    };

    // Sign payload
    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret)
        .update(`${timestamp}.${delivery.payload}`)
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
        body: delivery.payload,
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
    const newAttempts = delivery.attempts + 1;

    // Determine final status
    let finalStatus: 'SUCCESS' | 'FAILED' | 'RETRYING' | 'ABORTED' = status;
    if (status === 'FAILED' && newAttempts >= delivery.maxRetries) {
      finalStatus = 'ABORTED';
    }

    // Update delivery record
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: finalStatus,
        statusCode,
        response: responseStr,
        attempts: newAttempts,
        duration,
        errorMessage,
        completedAt: finalStatus !== 'RETRYING' ? new Date() : undefined,
      },
    });

    // Update webhook stats
    await db.webhook.update({
      where: { id: webhook.id },
      data: {
        lastDeliveryAt: new Date(),
        lastStatusCode: statusCode,
        lastError: errorMessage,
        successCount: finalStatus === 'SUCCESS' ? { increment: 1 } : undefined,
        failureCount: finalStatus !== 'SUCCESS' ? { increment: 1 } : undefined,
      },
    });

    return NextResponse.json({
      data: { success: finalStatus === 'SUCCESS', status: finalStatus, statusCode, duration, attempts: newAttempts },
      meta: { requestId: '' },
    });
  } catch (error) {
    console.error('[WEBHOOK_DELIVERIES:RETRY] —', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to retry delivery' }, meta: { requestId: '' } },
      { status: 500 },
    );
  }
}
