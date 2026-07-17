import type { NextConfig } from "next";
import os from "node:os";

/** Hostnames browsers use when opening the Next.js Network URL (LAN testing). */
function localNetworkHosts(): string[] {
  const hosts = new Set<string>(["127.0.0.1", "0.0.0.0"]);
  try {
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.internal || entry.family !== "IPv4") continue;
        hosts.add(entry.address);
      }
    }
  } catch {
    // os.networkInterfaces can fail in restricted environments — env fallback below.
  }
  const fromEnv = process.env.ALLOWED_DEV_ORIGINS?.split(",") ?? [];
  for (const raw of fromEnv) {
    const host = raw.trim();
    if (host) hosts.add(host);
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Next 16 blocks /_next/* from non-localhost origins unless listed here.
  // Without this, LAN/phone pages never hydrate → login form does a dead GET.
  allowedDevOrigins: localNetworkHosts(),
};

export default nextConfig;
