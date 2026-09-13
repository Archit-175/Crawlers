import { NextResponse, type NextRequest } from 'next/server';
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const legacy = request.nextUrl.pathname.startsWith('/legacy/');
  const csp = legacy
    ? "default-src 'self' https: data:; script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; style-src 'self' https: 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'"
    : `default-src 'self'; script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'${dev ? ' ws: wss:' : ''}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}
export const config = {
  matcher: ['/((?!api/|_next/static/|_next/image/|favicon.ico|fonts/|library.json).*)'],
};
