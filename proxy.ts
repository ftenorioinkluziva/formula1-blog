import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/i18n/routing'

const intlMiddleware = createMiddleware(routing)

// Routes that require at least a valid session
const protectedPageRoutes = ['admin', 'live', 'watch', 'replay', 'fantasy']

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const method = request.method
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)

  // 1. Check if the path is a protected page
  const isProtectedPage = protectedPageRoutes.some(route => 
    pathname.match(new RegExp(`^\\/(pt|en|es)\\/${route}(\\/|$)`)) || 
    pathname === `/${route}` || 
    pathname.startsWith(`/${route}/`)
  )

  // 2. Check if the path is a protected API route (excluding public reads)
  // Note: /api/fantasy/rules, /api/f1tv/status and public GETs should remain accessible
  const isProtectedApi = 
    pathname.includes('/api/admin') ||
    pathname.includes('/api/recording') ||
    pathname.includes('/api/podcast') ||
    pathname.includes('/api/transcribe') ||
    pathname.includes('/api/pending-articles') ||
    (pathname.includes('/api/f1tv/') && !pathname.includes('/api/f1tv/status')) ||
    pathname.includes('/api/sync-standings') ||
    (pathname.includes('/api/watch/sync') && isMutation) ||
    (pathname.includes('/api/news') && isMutation) ||
    (pathname.includes('/api/fantasy') && isMutation && !pathname.includes('/api/fantasy/rules'))

  if (isProtectedPage || isProtectedApi) {
    const sessionToken = 
      request.cookies.get('better-auth.session_token') || 
      request.cookies.get('__Secure-better-auth.session_token')

    if (!sessionToken) {
      if (isProtectedApi) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      
      // Extract locale or default to 'en'
      const localeMatch = pathname.match(/^\/([^\/]+)/)
      const locale = localeMatch && routing.locales.includes(localeMatch[1] as any) 
        ? localeMatch[1] 
        : routing.defaultLocale
      
      const signInUrl = new URL(`/${locale}/sign-in`, request.url)
      signInUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(signInUrl)
    }
  }

  return intlMiddleware(request)
}

export const config = {
  // Match all paths except Static Files, _next, and Better Auth endpoints (/api/auth/*)
  matcher: [
    '/', 
    '/(pt|en|es)/:path*', 
    '/((?!_next|_vercel|api/auth|.*\\..*).*)'
  ],
}