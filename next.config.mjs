/** @type {import("next").NextConfig} */
// Static export mode: the app is 100% client-side fetch (no server code),
// so we can output plain HTML+JS+CSS for any static host (Sevalla, Vercel
// static, Netlify, S3+CloudFront, etc.).
//
// Notes for static export:
//   - headers()/redirects()/rewrites() in next.config are NOT applied; CSP
//     and other security headers are set via the public/_headers file
//     (consumed by Sevalla, Netlify, Cloudflare Pages) and a <meta> tag in
//     app/layout.tsx as a fallback for hosts that ignore _headers.
//   - next/image optimization is disabled (unoptimized: true) since there's
//     no Next.js server to run the image loader.
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  experimental: {
    optimizePackageImports: ['@react-three/drei', '@react-three/fiber'],
  },
}

export default nextConfig
