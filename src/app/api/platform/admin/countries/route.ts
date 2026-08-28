import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { listCountries, upsertCountry, deleteCountry } from '@/lib/platform/country-pricing';
import { logAdminAction } from '@/lib/platform/audit';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  return ok(await listCountries());
}

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const body = await request.json().catch(() => ({}));
  const country = await upsertCountry(body);
  if (!country) return fail('VALIDATION_ERROR', 'Invalid country data.', 400);
  await logAdminAction({
    userId: auth.user.id,
    action: 'country.upserted',
    resourceType: 'CountryPricing',
    resourceId: country.id,
    details: `${country.countryCode} ${country.countryName} currency=${country.currency} default=${country.isDefault}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(country);
}

export async function DELETE(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return fail('VALIDATION_ERROR', 'id query param is required.', 400);
  const deleted = await deleteCountry(id);
  if (!deleted) return fail('NOT_FOUND', 'Country not found.', 404);
  await logAdminAction({
    userId: auth.user.id,
    action: 'country.deleted',
    resourceType: 'CountryPricing',
    resourceId: id,
    details: 'Country pricing deleted',
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok({ deleted: true });
}
