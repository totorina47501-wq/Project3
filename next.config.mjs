/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Les fichiers SVG utilisateurs ne passent jamais par l'optimiseur d'images.
  images: { dangerouslyAllowSVG: false, remotePatterns: [] },
};

export default nextConfig;
