/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  transpilePackages: ['firebase', '@firebase/auth', '@firebase/firestore', 'undici']
}

module.exports = nextConfig
