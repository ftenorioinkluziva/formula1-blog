import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.platform === 'win32' ? undefined : 'standalone',
  serverExternalPackages: [
    '@elevenlabs/elevenlabs-js',
    '@google/generative-ai',
    '@microsoft/signalr',
    'cloudinary',
    'pg',
    'redis',
    'ws',
  ],
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^pg-native$/,
      }),
    )

    return config
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'f1tv.formula1.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https://res.cloudinary.com https:",
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
              "connect-src 'self' https://f1tv-proxy.blackboxinovacao.com.br https://ott-video-fer-cf.formula1.com https://ott-video-cf.formula1.com https://f1tv.formula1.com https://livetiming.formula1.com https://f1prodlive.akamaized.net https://*.akamaized.net https://*.drmtoday.com https://widevine-proxy.formula1.com",
              "font-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
