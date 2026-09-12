/**
 * A small, deterministic "glued on slightly crooked" tilt for a calendar
 * day's stamp — every stamp landing at the exact same straight angle read
 * as too neat/printed for something meant to look hand-stuck-on. Derived
 * from `seed` (the day's dateKey) rather than `Math.random()`: a given
 * day's stamp should tilt the same way every time that cell re-renders,
 * and a client-only random pick would also mismatch the server-rendered
 * markup on hydration (this is a shared React-in-Next.js pitfall, not
 * specific to this app — `Math.random()` in render is never safe here).
 */
export function stampTiltDeg(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  // A plain "hash = hash*31 + charCode" loop barely spreads short,
  // near-identical inputs: every dateKey in a month shares the same
  // "YYYY-MM-" prefix and differs only in its last two (small, low-ASCII)
  // digits, so consecutive days' raw hashes only differed from each
  // other by that tiny suffix contribution — %1000 alone couldn't undo
  // that, and a whole month's tilts landed within about a degree of each
  // other. fmix32 (MurmurHash3's finalizer) is built exactly to fix this:
  // it avalanches a small input difference across the full 32-bit range
  // before anything else touches it, so neighboring days land nowhere
  // near each other after the modulo below.
  hash = fmix32(hash);
  // Started at ±2° ("정갈하게 붙어있다" — too neatly straight — was the
  // complaint, not "crooked envelope stamp"), bumped to ±5° on request:
  // still reads as hand-placed rather than knocked over.
  const MAX_DEG = 5;
  const normalized = (Math.abs(hash) % 1000) / 1000; // 0 – 0.999
  return (normalized * 2 - 1) * MAX_DEG; // -5 – 5
}

function fmix32(h: number): number {
  let x = h;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x;
}
