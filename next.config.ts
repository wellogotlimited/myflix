import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@p-stream/providers"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      }
    ],
  },
  devIndicators: false
};

export default nextConfig;
