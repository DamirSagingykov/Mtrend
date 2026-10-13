import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const production = process.env.ROBOTS_ALLOW_INDEX === "true";
  return {
    rules: production
      ? [
          {
            userAgent: "*",
            allow: "/",
            disallow: ["/admin", "/api/", "/*/cart", "/*/checkout", "/*/account", "/*/order/", "/*/favorites", "/*/search", "/*?*sort=", "/*?*size=", "/*?*color="],
          },
        ]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${env.appUrl}/sitemap.xml`,
    host: env.appUrl,
  };
}
