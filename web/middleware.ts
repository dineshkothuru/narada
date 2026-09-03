import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, canAccess, verifyToken } from "@/lib/admin-auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }
  const role = await verifyToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (canAccess(pathname, role)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: role ? "forbidden for your role" : "unauthorized" },
      { status: role ? 403 : 401 },
    );
  }
  const login = req.nextUrl.clone();
  login.pathname = "/admin/login";
  login.searchParams.set("next", pathname);
  if (role) login.searchParams.set("denied", role);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/kitchen/:path*",
    "/waiter/:path*",
    "/floor/:path*",
    "/counter/:path*",
    "/api/kitchen/:path*",
    "/api/admin/:path*",
    "/api/waiter/:path*",
    "/api/floor/:path*",
    "/api/counter/:path*",
    "/api/availability/:path*",
  ],
};
