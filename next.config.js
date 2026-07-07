/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow raw body capture for webhook route
  // (handled per-route via exported config in the route file)
  eslint: {
    // Next 14's built-in lint runner still passes legacy ESLint options.
    // CI runs tests + typechecked production build; lint can be re-enabled
    // once the Next/ESLint versions are aligned.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
