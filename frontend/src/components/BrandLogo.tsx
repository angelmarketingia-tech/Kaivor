'use client';

/**
 * Daptux pixel-robot isotype + Kaivor wordmark.
 * Vector recreation of the official logo so it stays crisp and theme-aware.
 * The robot ink adapts to theme; the eyes/mouth are always brand lime.
 */

const LIME = '#A3CC39';

export function RobotMark({ size = 28, ink }: { size?: number; ink?: string }) {
  // 11x10 pixel grid. body = ink, eyes+mouth = lime.
  const inkColor = ink || 'currentColor';
  const u = size / 11;
  // body pixels (col,row) — a compact friendly robot head with antenna ears
  const body: [number, number][] = [
    // top row of head
    [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
    // sides
    [2, 2], [3, 2], [7, 2], [8, 2],
    [1, 3], [2, 3], [8, 3], [9, 3],
    [2, 4], [3, 4], [7, 4], [8, 4],
    // face block
    [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
    [3, 5], [4, 5], [5, 5], [6, 5], [7, 5],
    [3, 6], [4, 6], [5, 6], [6, 6], [7, 6],
    [2, 5], [8, 5],
    // legs
    [3, 7], [4, 7], [6, 7], [7, 7],
    [3, 8], [7, 8],
  ];
  const eyes: [number, number][] = [[4, 4], [6, 4]];
  const mouth: [number, number][] = [[5, 6]];

  const rect = (x: number, y: number, c: string, key: string) => (
    <rect key={key} x={x * u} y={y * u} width={u + 0.4} height={u + 0.4} fill={c} rx={u * 0.18} />
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      {body.map(([x, y], i) => rect(x, y, inkColor, `b${i}`))}
      {eyes.map(([x, y], i) => rect(x, y, LIME, `e${i}`))}
      {mouth.map(([x, y], i) => rect(x, y, LIME, `m${i}`))}
    </svg>
  );
}

/** Full lockup: robot + "Kaivor" wordmark with the lime dot. */
export function BrandLogo({
  size = 28,
  className = '',
  showByline = false,
  ink,
}: {
  size?: number;
  className?: string;
  showByline?: boolean;
  ink?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <RobotMark size={size} ink={ink} />
      <div className="flex flex-col leading-none">
        <span className="font-bold tracking-tight" style={{ fontSize: size * 0.78, color: ink || 'currentColor' }}>
          Kaivor<span style={{ color: LIME }}>.</span>
        </span>
        {showByline && (
          <span className="tracking-[0.18em] uppercase mt-0.5" style={{ fontSize: size * 0.26, color: 'var(--text-muted)' }}>
            by Daptux.ia
          </span>
        )}
      </div>
    </div>
  );
}

export default BrandLogo;
