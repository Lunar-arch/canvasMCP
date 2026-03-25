import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "puppeteer", "puppeteer-extra", "puppeteer-extra-plugin-stealth"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
