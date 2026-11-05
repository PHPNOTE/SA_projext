/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/repairs/register',
        destination: '/front-desk/check-in',
        permanent: true,
      },
      {
        source: '/repairs/queue',
        destination: '/front-desk/queue',
        permanent: true,
      },
      {
        source: '/repairs/billing',
        destination: '/front-desk/billing',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
