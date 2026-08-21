/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // The workspace lived at /studio before the rename; keep old links alive.
    return [{ source: '/studio', destination: '/panel', permanent: true }];
  },
};

export default nextConfig;
