/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/covers/**" },
      { protocol: "https", hostname: "**", pathname: "/api/covers/**" },
    ],
  },
};
module.exports = nextConfig;
