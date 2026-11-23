import type { ResolvedTheme } from '../theme/useStudioTheme';

export const ART_WIDTH = 1600;
export const ART_HEIGHT = 900;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paintNordicMist(ctx: CanvasRenderingContext2D, theme: ResolvedTheme): void {
  const rand = mulberry32(2026);
  const horizonY = Math.round(ART_HEIGHT * 0.62);
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  if (theme === 'light') {
    sky.addColorStop(0, '#b9c7d6');
    sky.addColorStop(0.55, '#d5dde6');
    sky.addColorStop(1, '#eae8e2');
  } else {
    sky.addColorStop(0, '#101622');
    sky.addColorStop(0.55, '#1d293b');
    sky.addColorStop(1, '#2b394d');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ART_WIDTH, horizonY);

  const glow = ctx.createRadialGradient(
    ART_WIDTH * 0.52,
    horizonY * 0.72,
    20,
    ART_WIDTH * 0.52,
    horizonY * 0.72,
    520,
  );
  glow.addColorStop(
    0,
    theme === 'light' ? 'rgba(255, 252, 245, 0.72)' : 'rgba(147, 197, 253, 0.18)',
  );
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, ART_WIDTH, horizonY);

  const ridgeColors = theme === 'light'
    ? ['#c2cedb', '#a8b7c7', '#8ea0b3', '#718499', '#56687d']
    : ['#263549', '#202d3e', '#1a2433', '#151d29', '#101620'];

  ridgeColors.forEach((col, layer) => {
    const baseY = horizonY - (4 - layer) * 48 - 18;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= ART_WIDTH; x += 28) {
      const wave = Math.sin(x * 0.0042 + layer * 1.9) * (36 - layer * 4)
        + Math.cos(x * 0.011 + layer) * 14
        + (rand() - 0.5) * 11;
      ctx.lineTo(x, baseY - Math.abs(wave));
    }
    ctx.lineTo(ART_WIDTH, horizonY);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();

    const mist = ctx.createLinearGradient(0, baseY - 22, 0, horizonY);
    mist.addColorStop(0, 'rgba(0,0,0,0)');
    mist.addColorStop(
      1,
      theme === 'light' ? 'rgba(240, 239, 235, 0.34)' : 'rgba(186, 204, 224, 0.08)',
    );
    ctx.fillStyle = mist;
    ctx.fillRect(0, baseY - 22, ART_WIDTH, horizonY - baseY + 22);
  });

  const lake = ctx.createLinearGradient(0, horizonY, 0, ART_HEIGHT);
  if (theme === 'light') {
    lake.addColorStop(0, '#c8d1dc');
    lake.addColorStop(1, '#9eacbc');
  } else {
    lake.addColorStop(0, '#18212d');
    lake.addColorStop(1, '#0e131b');
  }
  ctx.fillStyle = lake;
  ctx.fillRect(0, horizonY, ART_WIDTH, ART_HEIGHT - horizonY);

  for (let i = 0; i < 65; i++) {
    const ry = horizonY + 8 + rand() * (ART_HEIGHT - horizonY - 12);
    const rx = rand() * ART_WIDTH;
    const rw = 40 + rand() * 180;
    ctx.fillStyle = theme === 'light' ? 'rgba(255,255,255,0.22)' : 'rgba(148,163,184,0.08)';
    ctx.fillRect(rx, ry, rw, 1.3);
  }
}

export function paintStudioBokeh(ctx: CanvasRenderingContext2D, theme: ResolvedTheme): void {
  const rand = mulberry32(7741);
  const bg = ctx.createLinearGradient(0, 0, ART_WIDTH, ART_HEIGHT);
  if (theme === 'light') {
    bg.addColorStop(0, '#eae8e1');
    bg.addColorStop(0.5, '#dfe4ec');
    bg.addColorStop(1, '#eceae3');
  } else {
    bg.addColorStop(0, '#13161f');
    bg.addColorStop(0.5, '#19202e');
    bg.addColorStop(1, '#12151c');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);

  const palette = theme === 'light'
    ? ['59,130,246', '16,185,129', '100,116,139', '180,158,118']
    : ['96,165,250', '52,211,153', '203,213,225', '212,190,152'];

  for (let i = 0; i < 42; i++) {
    const x = rand() * ART_WIDTH;
    const y = rand() * ART_HEIGHT;
    const r = 24 + rand() * 118;
    const rgb = palette[i % palette.length]!;
    const alpha = (theme === 'light' ? 0.08 : 0.06) + rand() * 0.09;
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, `rgba(${rgb}, ${alpha * 0.55})`);
    g.addColorStop(0.78, `rgba(${rgb}, ${alpha})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.85})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  }
}

