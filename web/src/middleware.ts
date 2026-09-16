import { NextResponse, type NextRequest } from "next/server";
import {
  HOST_FRAME_ANCESTORS,
  hostCorsHeaders,
  isHostParentOrigin,
  isHostPath,
} from "@/lib/hostFrame";

function withCors(res: NextResponse, origin: string): NextResponse {
  const headers = hostCorsHeaders(origin);
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin")?.trim() || "";
  const self = req.nextUrl.origin;

  if (pathname === "/api/user/host") {
    if (origin && !isHostParentOrigin(origin, self)) {
      return new NextResponse(null, { status: 403 });
    }
    if (req.method === "OPTIONS") {
      const res = new NextResponse(null, { status: 204 });
      return origin ? withCors(res, origin) : res;
    }
    const res = NextResponse.next();
    return origin ? withCors(res, origin) : res;
  }

  if (isHostPath(pathname)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-embody-host", "1");
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", `frame-ancestors ${HOST_FRAME_ANCESTORS}`);
    res.headers.delete("X-Frame-Options");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/user/host", "/b/:id/host"],
};
