import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect these routes
  const protectedRoutes = ["/dashboard", "/events", "/finance", "/hr"];
  const isProtected = protectedRoutes.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return NextResponse.next();

  // Supabase auth stores session in cookies; if missing -> go login
  // This is a simple guard (works well for your current setup).
  const hasAnySupabaseCookie =
    req.cookies.get("sb-access-token") ||
    req.cookies.get("sb-refresh-token") ||
    // some supabase projects use different cookie keys; this still catches many cases
    req.cookies.get("supabase-auth-token");

  if (!hasAnySupabaseCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/events/:path*", "/finance/:path*", "/hr/:path*"],
};

