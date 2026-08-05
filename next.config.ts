import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // The presentation deck is a static file; serve it at the tidy /deck URL.
    return [{ source: "/deck", destination: "/deck/index.html" }];
  },
};

export default nextConfig;
