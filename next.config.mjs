/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dealership + app databases are accessed via Node's built-in
  // `node:sqlite` module. Nothing extra to externalize (no native addon).
};

export default nextConfig;
