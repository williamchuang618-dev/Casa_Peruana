import type { NextConfig } from 'next';

/**
 * Next's dev server only serves its client assets to origins it trusts. Opened
 * from another device on the wifi — http://10.0.0.107:5240 rather than
 * localhost — the page still renders, but React never hydrates: no attendance
 * buttons, no search, no view switching. It looks fine and does nothing.
 *
 * So the private LAN ranges are trusted here, plus whatever address
 * `npm run share` detected at launch. This is a development setting only; it
 * has no effect on a production build.
 */
const shared = process.env.LAN_ORIGIN ? [process.env.LAN_ORIGIN] : [];

const nextConfig: NextConfig = {
  // Hostnames and globs only — CIDR notation is not understood here.
  allowedDevOrigins: [
    ...shared,
    // RFC 1918 space, where home and campus networks live.
    '10.*.*.*',
    '172.16.*.*',
    '172.17.*.*',
    '172.18.*.*',
    '172.19.*.*',
    '172.2*.*.*',
    '172.30.*.*',
    '172.31.*.*',
    '192.168.*.*',
    // Bonjour hostnames, e.g. williams-macbook-air.local
    '*.local',
  ],
};

export default nextConfig;
