import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* No basePath needed — app routes already start with /portal/
     nginx proxies /portal, /login, /admin, /api, /_next to Next.js */
};

export default nextConfig;
