import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pmvwdqdmmkmtmnumaocx.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true, // ⛔ lewati TypeScript error saat build
  },
  eslint: {
    ignoreDuringBuilds: true, // ⛔ lewati ESLint error saat build
  },
};

export default nextConfig;
