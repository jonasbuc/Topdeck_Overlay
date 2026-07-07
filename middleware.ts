import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE = "topdeck_admin";

function adminToken(): string | null {
  return process.env.TOPDECK_ADMIN_TOKEN?.trim() || null;
}

function isProtectedWrite(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/tournaments/")) return false;
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return false;
  }
  if (pathname.includes("/judge-calls") && req.method === "POST") {
    return false;
  }
  return true;
}

function isProtectedPage(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/producer/")
  );
}

function suppliedToken(req: NextRequest): string | null {
  return (
    req.headers.get("x-topdeck-admin-token") ||
    req.nextUrl.searchParams.get("admin") ||
    req.cookies.get(ADMIN_COOKIE)?.value ||
    null
  );
}

export function middleware(req: NextRequest) {
  const token = adminToken();
  if (!token) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (!isProtectedPage(pathname) && !isProtectedWrite(req)) {
    return NextResponse.next();
  }

  if (suppliedToken(req) === token) {
    const res = NextResponse.next();
    if (req.nextUrl.searchParams.get("admin") === token) {
      res.cookies.set(ADMIN_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
    }
    return res;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "admin_token_required" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/";
  loginUrl.searchParams.set("auth", "required");
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/producer/:path*", "/api/:path*"],
};
