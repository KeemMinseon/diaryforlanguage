import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Diary photo stamps are served from the project's own Supabase
    // Storage bucket (a public URL under .../storage/v1/object/public/...).
    // The project ref varies per deployment, so this matches any
    // `*.supabase.co` host rather than hardcoding one, scoped to just the
    // public-storage path so it can't be used as an open image proxy.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
