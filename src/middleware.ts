import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "./i18n/config";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);

  if (pathname.startsWith("/admin")) {
    requestHeaders.set("x-mtrend-area", "admin");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    requestHeaders.set("x-mtrend-locale", first);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (req.cookies.get("mt_locale")?.value !== first) {
      res.cookies.set("mt_locale", first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  }

  const cookieLocale = req.cookies.get("mt_locale")?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!api|_next|media|demo|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.[a-zA-Z0-9]{2,5}$).*)"],
};
