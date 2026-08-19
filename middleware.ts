import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Redirect middleware — intercepts every request and checks
 * the Redirect table for matching paths. Increments hit count on match.
 */
export async function middleware(request: NextRequest) {
  // Only handle API redirect hit tracking or page-like paths
  const { pathname } = request.nextUrl;

  // Skip Next.js internals, API routes, static files, and _next
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/__nextjs') ||
    pathname.includes('.') // static files with extensions
  ) {
    return NextResponse.next();
  }

  try {
    // Find active redirect matching this path
    const redirect = await db.redirect.findFirst({
      where: {
        fromPath: pathname,
        isActive: true,
      },
    });

    if (redirect) {
      // Increment hit count (fire-and-forget)
      db.redirect.update({
        where: { id: redirect.id },
        data: { hitCount: { increment: 1 } },
      }).catch(() => {});

      // Determine HTTP status code
      let statusCode = 301;
      switch (redirect.type) {
        case 'TEMPORARY_302':
          statusCode = 302;
          break;
        case 'TEMPORARY_307':
          statusCode = 307;
          break;
        case 'PERMANENT_308':
          statusCode = 308;
          break;
        default:
          statusCode = 301;
      }

      const url = request.nextUrl.clone();
      url.pathname = redirect.toPath;

      return NextResponse.redirect(url, statusCode);
    }
  } catch {
    // If DB fails, just continue normally
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next (static files)
     * - api (API routes)
     * - __nextjs (Next.js internals)
     * - favicon.ico, etc.
     */
    '/((?!_next|api|__nextjs|.*\..*).*)',
  ],
};
