import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/events/:path*",
    "/tasks/:path*",
    "/vendors/:path*",
    "/hr/:path*",
    "/finance/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();

  const cookies = req.cookies.getAll();
  const isLoggedIn =
    cookies.some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && !!c.value?.length) ||
    cookies.some((c) => c.name === "sb-access-token" && !!c.value?.length) ||
    cookies.some((c) => c.name === "sb-refresh-token" && !!c.value?.length) ||
    cookies.some((c) => c.name === "supabase-auth-token" && !!c.value?.length);

  if (!isLoggedIn) {
    url.pathname = "/login";
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
