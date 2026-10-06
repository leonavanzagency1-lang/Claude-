import type { NextConfig } from "next";

// Gör det möjligt att öppna utvecklingsservern från mobilen i samma nätverk,
// t.ex. DEV_ALLOWED_ORIGINS=192.168.1.20 (kommaseparerat).
const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  // Paket som körs i Node på serversidan och inte ska paketeras.
  serverExternalPackages: ["@react-pdf/renderer", "sharp"],
};

export default nextConfig;
