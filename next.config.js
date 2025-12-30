/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    
    // Build CSP string
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://*.googleapis.com https://firebasestorage.googleapis.com",
      "font-src 'self' data:",
      // Add ws://localhost:* for HMR in dev
      `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net ${isDev ? 'ws://localhost:*' : ''}`,
      "object-src 'self' blob: data:",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src 'self' blob: data: https://firebasestorage.googleapis.com https://docs.google.com",
      // Only upgrade insecure requests in production
      isDev ? "" : "upgrade-insecure-requests",
      isDev ? "" : "block-all-mixed-content"
    ].join('; ').replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Only send HSTS in production to avoid locking localhost to HTTPS
          ...(isDev ? [] : [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          }]),
        ],
      },
    ];
  },
};

module.exports = nextConfig;
