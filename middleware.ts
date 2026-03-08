import { NextResponse } from "next/server";
import { authSession } from "./src/auth/auth";

function loginRedirect(req: { nextUrl: URL }) {
  const callbackUrl = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, req.nextUrl));
}

export default authSession((req) => {
  const pathname = req.nextUrl.pathname;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/admin")) {
    if (role !== "admin") return loginRedirect(req);
    return NextResponse.next();
  }

  if (pathname.startsWith("/driver")) {
    if (role !== "driver") return loginRedirect(req);
    return NextResponse.next();
  }

  if (pathname === "/login" && role) {
    const target = role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/";
    return NextResponse.redirect(new URL(target, req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/driver/:path*", "/login"]
};

