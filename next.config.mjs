/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Temporary: serve the static prototype at `/` until the real pages exist.
  async rewrites() {
    return [{ source: '/', destination: '/daily-word-froyo-crush.html' }];
  },
};

export default nextConfig;
