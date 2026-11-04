/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // OpenNext doit disposer de .next/standalone pour construire le Worker.
  output: 'standalone',
  poweredByHeader: false,
  // Borner les workers de build évite de dépendre du nombre de CPU de la CI.
  experimental: { cpus: 2 },
  // Les fichiers SVG utilisateurs ne passent jamais par l'optimiseur d'images.
  images: { dangerouslyAllowSVG: false, remotePatterns: [] },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      ],
    }];
  },
};

export default nextConfig;
