const SITE_URL = "https://derbix.co";

export default function handler(_req: Request) {
  const robotsTxt = `User-agent: *
Allow: /
Allow: /predicciones/
Allow: /estadisticas
Allow: /pricing

Disallow: /app/
Disallow: /admin/
Disallow: /api/
Disallow: /reset-password

Sitemap: ${SITE_URL}/sitemap.xml
`;

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400",
    },
  });
}

export const config = { path: "/robots.txt" };
