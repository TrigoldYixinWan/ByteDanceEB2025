import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Route classification
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const isPortalRoute = request.nextUrl.pathname.startsWith('/portal')
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  // PUBLIC ROUTE: Allow access to login page for unauthenticated users
  if (isAuthRoute && !user) {
    return supabaseResponse
  }

  // PROTECTED ROUTES: Redirect to login if not authenticated
  if (!user && (isPortalRoute || isAdminRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // AUTHENTICATED USER: Fetch profile and enforce role-based access
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      // Redirect to login if profile doesn't exist
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const userRole = profile.role

    // ROLE ENFORCEMENT: Admin routes strictly require admin role
    if (isAdminRoute && userRole !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/portal' // Redirect merchants to their dashboard
      return NextResponse.redirect(url)
    }

    // ROLE ENFORCEMENT: Portal routes strictly require merchant role
    if (isPortalRoute && userRole !== 'merchant') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/dashboard' // Redirect admins to their dashboard
      return NextResponse.redirect(url)
    }

    // LOGGED IN USER on login page: Redirect to appropriate dashboard
    if (isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = userRole === 'admin' ? '/admin/dashboard' : '/portal'
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so: const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so: myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing the cookies!
  // 4. Finally: return myNewResponse
  // If this is not done, you may be causing the browser and server to go out of sync and terminate the user's session prematurely!

  return supabaseResponse
}

