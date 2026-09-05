#!/usr/bin/env node
/**
 * Run the app for a room full of people on the same wifi.
 *
 * Binds to every network interface instead of just this Mac, then prints the
 * address people should type. The address is looked up fresh each time because
 * it changes whenever you join a different network — campus wifi today, your
 * apartment tomorrow.
 *
 * Run: npm run share
 */
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT ?? '5240';

function lanAddress() {
  // Prefer normal wifi/ethernet over VPN and virtual adapters.
  const preferred = ['en0', 'en1', 'en2'];
  const found = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) found.push({ name, address: a.address });
    }
  }
  for (const p of preferred) {
    const hit = found.find((f) => f.name === p);
    if (hit) return hit.address;
  }
  return found[0]?.address ?? null;
}

const ip = lanAddress();
const line = '─'.repeat(46);

console.log(`
${line}
  LA CASA PERUANA — sharing on this network

  On your phone or laptop, open:

      ${ip ? `http://${ip}:${PORT}` : 'no network found — connect to wifi first'}

  Everyone has to be on the same wifi.
  Keep this window open and the laptop awake.
  Press Ctrl+C to stop sharing.
${line}
`);

if (!ip) process.exit(1);

// macOS may ask to allow incoming connections the first time. Say yes.
//
// LAN_ORIGIN is read by next.config.ts and added to allowedDevOrigins. Without
// it the dev server refuses to hand its client assets to a phone, and the page
// renders but never becomes interactive.
spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', PORT], {
  stdio: 'inherit',
  env: { ...process.env, LAN_ORIGIN: ip },
}).on('exit', (code) => process.exit(code ?? 0));
