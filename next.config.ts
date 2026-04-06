import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "puppeteer", "puppeteer-extra", "puppeteer-extra-plugin-stealth"],
};

export default nextConfig;
