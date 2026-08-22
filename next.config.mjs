/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Old paths from before renames; keep old links alive.
    return [
      { source: '/studio', destination: '/panel', permanent: true },
      { source: '/vision.html', destination: '/vision', permanent: true },
    ];
  },
};

export default nextConfig;
