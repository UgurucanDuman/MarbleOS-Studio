import type { ResolvedTheme } from '../theme/useStudioTheme';
import { ART_HEIGHT, ART_WIDTH, mulberry32 } from './wallpaperScenePainters';

/** Keskin, çok tepeli dağ sırtı: üçgen dalgalar + küçük kayalık kırılmalar. */
function ridgeY(x: number, base: number, height: number, period: number, shift: number, rand: () => number): number {
  const t = ((x / period + shift) % 1 + 1) % 1;
  const tri = 1 - Math.abs(t * 2 - 1);
  const t2 = ((x / (period * 0.37) + shift * 1.7) % 1 + 1) % 1;
  const tri2 = 1 - Math.abs(t2 * 2 - 1);
  return base - height * (0.72 * tri ** 1.6 + 0.28 * tri2) - rand() * 6;
}

/** Yıldızlı gece göğü, parlak zümrüt-mor aurora perdeleri ve keskin dağ silüeti. */
export function paintPolarAurora(ctx: CanvasRenderingContext2D, theme: ResolvedTheme): void {
  const rand = mulberry32(5303);
  const light = theme === 'light';
  const sky = ctx.createLinearGradient(0, 0, 0, ART_HEIGHT);
  sky.addColorStop(0, light ? '#14223f' : '#010208');
  sky.addColorStop(0.55, light ? '#24406a' : '#06101f');
  sky.addColorStop(1, light ? '#3d6589' : '#0a1a26');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);

  for (let i = 0; i < 520; i++) {
    const r = rand() < 0.93 ? 0.5 + rand() * 0.8 : 1.3 + rand() * 1.2;
    ctx.fillStyle = `rgba(226, 236, 255, ${0.3 + rand() * 0.7})`;
    ctx.beginPath();
    ctx.arc(rand() * ART_WIDTH, rand() * ART_HEIGHT * 0.66, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const haze = ctx.createRadialGradient(ART_WIDTH * 0.48, ART_HEIGHT * 0.42, 40, ART_WIDTH * 0.48, ART_HEIGHT * 0.42, 760);
  haze.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
  haze.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);

  // Her perde ince dikey ışınlardan oluşur: alt kenar parlak zümrüt, üst uç mora erir.
  const curtains = [
    { base: 0.44, amp: 90, freq: 0.0019, phase: 0.4, height: 330, glow: 0.5 },
    { base: 0.34, amp: 70, freq: 0.0027, phase: 2.2, height: 260, glow: 0.36 },
    { base: 0.52, amp: 50, freq: 0.0034, phase: 4.1, height: 200, glow: 0.28 },
  ];
  for (const c of curtains) {
    for (let x = 0; x <= ART_WIDTH; x += 2) {
      const foot = ART_HEIGHT * c.base + Math.sin(x * c.freq + c.phase) * c.amp
        + Math.sin(x * c.freq * 3.1 + c.phase) * c.amp * 0.18;
      const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(x * 0.006 + c.phase * 1.3)) ** 0.6;
      const strength = c.glow * pulse * (0.75 + rand() * 0.25);
      const top = foot - c.height * (0.7 + 0.3 * pulse);
      const ray = ctx.createLinearGradient(x, top, x, foot + 18);
      ray.addColorStop(0, 'rgba(139, 92, 246, 0)');
      ray.addColorStop(0.45, `rgba(139, 92, 246, ${strength * 0.35})`);
      ray.addColorStop(0.86, `rgba(52, 211, 153, ${strength})`);
      ray.addColorStop(0.95, `rgba(167, 243, 208, ${strength * 0.9})`);
      ray.addColorStop(1, 'rgba(52, 211, 153, 0)');
      ctx.fillStyle = ray;
      ctx.fillRect(x, top, 2, foot - top + 18);
    }
  }
  ctx.restore();

  const ridges = light
    ? [{ c: '#2a4565', h: 230, p: 520 }, { c: '#1a2d45', h: 190, p: 380 }, { c: '#0e1a2a', h: 130, p: 300 }]
    : [{ c: '#0c1724', h: 240, p: 540 }, { c: '#060d17', h: 200, p: 400 }, { c: '#010307', h: 140, p: 310 }];
  ridges.forEach((ridge, layer) => {
    const base = ART_HEIGHT * (0.86 + layer * 0.05);
    const shift = rand();
    ctx.beginPath();
    ctx.moveTo(0, ART_HEIGHT);
    for (let x = 0; x <= ART_WIDTH; x += 8) ctx.lineTo(x, ridgeY(x, base, ridge.h, ridge.p, shift, rand));
    ctx.lineTo(ART_WIDTH, ART_HEIGHT);
    ctx.closePath();
    ctx.fillStyle = ridge.c;
    ctx.fill();
    if (layer === 0) {
      ctx.strokeStyle = light ? 'rgba(186, 230, 253, 0.35)' : 'rgba(110, 231, 183, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  });
}

/** Saf siyah zeminde safir ve gümüş ışık alan, birbirinin üstünden akan kalın ipek şeritler. */
export function paintGraphiteSilk(ctx: CanvasRenderingContext2D, theme: ResolvedTheme): void {
  const light = theme === 'light';
  const bg = ctx.createLinearGradient(0, 0, ART_WIDTH, ART_HEIGHT);
  bg.addColorStop(0, light ? '#f3f5f9' : '#000000');
  bg.addColorStop(0.55, light ? '#e2e8f1' : '#05070d');
  bg.addColorStop(1, light ? '#f0f2f6' : '#000000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);

  const bands = [
    { rgb: '37, 99, 235', y: 0.3, amp: 150, thick: 230, freq: 0.0019, phase: 0.2 },
    { rgb: '148, 163, 184', y: 0.46, amp: 130, thick: 170, freq: 0.0023, phase: 1.4 },
    { rgb: '56, 189, 248', y: 0.58, amp: 120, thick: 210, freq: 0.0017, phase: 2.6 },
    { rgb: '99, 102, 241', y: 0.72, amp: 100, thick: 160, freq: 0.0026, phase: 3.9 },
  ];
  const sheenAlpha = light ? 0.75 : 0.5;

  for (const band of bands) {
    const edge = (x: number) => ART_HEIGHT * band.y - x * 0.12
      + Math.sin(x * band.freq + band.phase) * band.amp
      + Math.sin(x * band.freq * 2.4 + band.phase * 1.3) * band.amp * 0.2;
    const width = (x: number) => band.thick * (0.35 + 0.65 * (0.5 + 0.5 * Math.cos(x * 0.0021 + band.phase)));

    ctx.beginPath();
    ctx.moveTo(0, edge(0));
    for (let x = 0; x <= ART_WIDTH; x += 8) ctx.lineTo(x, edge(x));
    for (let x = ART_WIDTH; x >= 0; x -= 8) ctx.lineTo(x, edge(x) + width(x));
    ctx.closePath();

    const along = ctx.createLinearGradient(0, 0, ART_WIDTH, 0);
    const strong = light ? 0.55 : 0.85;
    along.addColorStop(0, `rgba(${band.rgb}, ${strong * 0.25})`);
    along.addColorStop(0.35, `rgba(${band.rgb}, ${strong})`);
    along.addColorStop(0.55, `rgba(255, 255, 255, ${light ? 0.7 : 0.38})`);
    along.addColorStop(0.75, `rgba(${band.rgb}, ${strong * 0.8})`);
    along.addColorStop(1, `rgba(${band.rgb}, ${strong * 0.15})`);
    ctx.fillStyle = along;
    ctx.fill();

    const depth = ctx.createLinearGradient(0, ART_HEIGHT * band.y - band.amp, 0, ART_HEIGHT * band.y + band.amp + band.thick);
    depth.addColorStop(0, 'rgba(0, 0, 0, 0)');
    depth.addColorStop(1, light ? 'rgba(30, 41, 59, 0.18)' : 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = depth;
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${sheenAlpha})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 0; x <= ART_WIDTH; x += 8) {
      if (x === 0) ctx.moveTo(x, edge(x));
      else ctx.lineTo(x, edge(x));
    }
    ctx.stroke();
  }

  const vignette = ctx.createRadialGradient(
    ART_WIDTH / 2, ART_HEIGHT / 2, ART_HEIGHT * 0.25, ART_WIDTH / 2, ART_HEIGHT / 2, ART_WIDTH * 0.72,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, light ? 'rgba(148, 163, 184, 0.28)' : 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);
}
