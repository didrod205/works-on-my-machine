// The legendary badge — a self-contained SVG in the shields.io flat style.
// Homage to Jeff Atwood's 2007 "Works on My Machine" certification program.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** ~6px per char approximation works fine for shields-style badges. */
function width(s: string): number {
  return Math.max(30, Math.round(s.length * 6.2) + 12);
}

export interface BadgeOptions {
  /** Right-side text. Default "my machine". */
  label?: string;
  /** Append the report fingerprint, e.g. "womm:3fa9c2d1". */
  fingerprint?: string;
}

/** "✓ works on | my machine" — fingerprint optional for receipts. */
export function renderBadge(opts: BadgeOptions = {}): string {
  const left = "✓ works on";
  const right = (opts.label ?? "my machine") + (opts.fingerprint ? ` · ${opts.fingerprint}` : "");
  const lw = width(left);
  const rw = width(right);
  const w = lw + rw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(left)}: ${esc(right)}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${rw}" height="20" fill="#2ea44f"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${esc(left)}</text>
    <text x="${lw + rw / 2}" y="14">${esc(right)}</text>
  </g>
</svg>
`;
}
