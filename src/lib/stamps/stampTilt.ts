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
  // Started at ±2° ("정갈하게 붙어있다" — too neatly straight — was the
  // complaint, not "crooked envelope stamp"), bumped to ±5° on request:
  // still reads as hand-placed rather than knocked over.
  const MAX_DEG = 5;
  const normalized = (Math.abs(hash) % 1000) / 1000; // 0 – 0.999
  return (normalized * 2 - 1) * MAX_DEG; // -5 – 5
}
