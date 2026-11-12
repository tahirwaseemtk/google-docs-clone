import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module and must be loaded at runtime, not bundled.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
