/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  eslint: {
    // No ESLint config ships with the repo, so Next.js skips the lint step;
    // keep this false so adding a config in future is enforced at build time.
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Type errors fail the build — this is what catches undefined names and
    // invalid hook usage before they can ship as runtime crashes.
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
