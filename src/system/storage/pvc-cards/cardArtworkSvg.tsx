import React, { useId } from 'react';
import type { TeacherChartPalette } from '../teacher-charts/types';
import type { PvcArtworkStyle, PvcCardSide } from './types';

/**
 * İZOLE SİSTEM KATMANI: Stüdyo Sınıfı Vektör PVC Kart Grafik Arka Plan Motoru (SVG)
 * 6 zengin katmanlı matbaa deseni: Kurumsal Dalga, Neşeli Geometrik, Prestij Akademik,
 * Dikey Lanyard Kemer, Akıllı Kampüs Tech Grid ve Güvenlik Ağı. Sıfır turuncu.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const PvcCardArtworkSvg: React.FC<{
  styleId: PvcArtworkStyle;
  side: PvcCardSide;
  widthMm: number;
  heightMm: number;
  palette: TeacherChartPalette;
}> = React.memo(({ styleId, side, widthMm, heightMm, palette }) => {
  const uid = useId().replace(/:/g, '');
  if (styleId === 'none') return null;

  const w = widthMm;
  const h = heightMm;
  const accent = palette.accent;
  const deep = palette.gridBorder;
  const soft = palette.headerTint;
  const mid = palette.finalTint;
  const isBack = side === 'back';

  return (
    <svg
      className="pvc-artwork-svg"
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`g1-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={deep} />
          <stop offset="55%" stopColor={accent} />
          <stop offset="100%" stopColor={deep} />
        </linearGradient>
        <linearGradient id={`g2-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor={deep} />
        </linearGradient>
        <linearGradient id={`gsoft-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={soft} />
          <stop offset="55%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={soft} stopOpacity="0.65" />
        </linearGradient>
        <pattern id={`dots-${uid}`} width="3.4" height="3.4" patternUnits="userSpaceOnUse">
          <circle cx="1.7" cy="1.7" r="0.34" fill={accent} fillOpacity="0.11" />
        </pattern>
      </defs>

      {styleId === 'corporate-wave' && (
        <>
          <rect width={w} height={h} fill={`url(#gsoft-${uid})`} />
          <g stroke={accent} strokeOpacity="0.07" strokeWidth="0.24" fill="none">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <path
                key={i}
                d={`M -2 ${17 + i * 5.2} Q ${w * 0.3} ${12 + i * 4.8}, ${w * 0.62} ${20 + i * 4.6} T ${w + 2} ${16 + i * 5.0}`}
              />
            ))}
          </g>
          {!isBack ? (
            <>
              <path d={`M 0 0 L ${w} 0 L ${w} 15.2 Q ${w * 0.66} 19.6, ${w * 0.34} 15.4 T 0 16.8 Z`} fill={mid} />
              <path d={`M 0 0 L ${w} 0 L ${w} 13.6 Q ${w * 0.66} 17.8, ${w * 0.34} 13.8 T 0 15.2 Z`} fill={`url(#g1-${uid})`} />
              <circle cx={w - 11} cy={5.5} r="10.5" fill="#ffffff" fillOpacity="0.07" />
              <circle cx={w - 3} cy={12} r="7.5" fill="#ffffff" fillOpacity="0.06" />
              <path d={`M 0 ${h} L ${w} ${h} L ${w} ${h - 4.2} Q ${w * 0.72} ${h - 1.2}, ${w * 0.36} ${h - 3.4} T 0 ${h - 2.0} Z`} fill={`url(#g1-${uid})`} />
            </>
          ) : (
            <>
              <path d={`M 0 0 L ${w} 0 L ${w} 8.4 Q ${w * 0.55} 11.2, 0 8.8 Z`} fill={`url(#g1-${uid})`} />
              <rect x={0} y={h - 15.6} width={w} height={15.6} fill={soft} />
              <line x1={0} y1={h - 15.6} x2={w} y2={h - 15.6} stroke={accent} strokeOpacity="0.38" strokeWidth="0.35" />
              <rect x={0} y={h - 1.8} width={w} height={1.8} fill={`url(#g1-${uid})`} />
            </>
          )}
        </>
      )}

      {styleId === 'modern-diagonal' && (
        <>
          <rect width={w} height={h} fill={`url(#gsoft-${uid})`} />
          <rect width={w} height={h} fill={`url(#dots-${uid})`} />
          {!isBack ? (
            <>
              <polygon points={`0,0 32,0 22,${h} 0,${h}`} fill={mid} />
              <polygon points={`0,0 24,0 14,${h} 0,${h}`} fill={`url(#g1-${uid})`} />
              <polygon points={`24,0 26.2,0 16.2,${h} 14,${h}`} fill="#ffffff" fillOpacity="0.85" />
              <circle cx={5.5} cy={h - 5.5} r="9" fill="#ffffff" fillOpacity="0.09" />
              <circle cx={14} cy={8} r="5.5" fill="#ffffff" fillOpacity="0.07" />
              <polygon points={`${w - 22},0 ${w},0 ${w},14`} fill={mid} />
              <polygon points={`${w - 13},0 ${w},0 ${w},8.4`} fill={`url(#g1-${uid})`} />
              <polygon points={`${w - 16},${h} ${w},${h - 10} ${w},${h}`} fill={accent} fillOpacity="0.18" />
            </>
          ) : (
            <>
              <polygon points={`0,0 11,0 7,${h} 0,${h}`} fill={`url(#g1-${uid})`} />
              <polygon points={`11,0 13,0 9,${h} 7,${h}`} fill={mid} />
              <polygon points={`${w - 16},0 ${w},0 ${w},9.5`} fill={accent} fillOpacity="0.16" />
              <rect x={8.5} y={h - 15.4} width={w - 8.5} height={15.4} fill={soft} />
              <line x1={8.5} y1={h - 15.4} x2={w} y2={h - 15.4} stroke={accent} strokeOpacity="0.35" strokeWidth="0.35" />
            </>
          )}
        </>
      )}

      {styleId === 'academic-crest' && (
        <>
          <rect width={w} height={h} fill={deep} />
          <rect x={1.8} y={1.8} width={w - 3.6} height={h - 3.6} rx="2.0" fill="#ffffff" />
          <rect x={2.6} y={2.6} width={w - 5.2} height={h - 5.2} rx="1.6" fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="0.3" />
          {!isBack ? (
            <>
              <path
                d={`M 1.8 3.8 Q 1.8 1.8 3.8 1.8 L ${w - 3.8} 1.8 Q ${w - 1.8} 1.8 ${w - 1.8} 3.8 L ${w - 1.8} 14.6 L 1.8 14.6 Z`}
                fill={`url(#g1-${uid})`}
              />
              <rect x={1.8} y={14.6} width={w - 3.6} height={1.0} fill={mid} />
              <rect x={w - 29.5} y={15.6} width={27.7} height={h - 17.4} fill={soft} />
              <line x1={w - 29.5} y1={15.6} x2={w - 29.5} y2={h - 1.8} stroke={accent} strokeOpacity="0.22" strokeWidth="0.35" />
              <circle cx={28} cy={34} r="14" fill="none" stroke={accent} strokeOpacity="0.06" strokeWidth="0.5" />
              <circle cx={28} cy={34} r="10.2" fill="none" stroke={accent} strokeOpacity="0.07" strokeWidth="0.28" strokeDasharray="1.4 1.2" />
            </>
          ) : (
            <>
              <path
                d={`M 1.8 3.8 Q 1.8 1.8 3.8 1.8 L ${w - 3.8} 1.8 Q ${w - 1.8} 1.8 ${w - 1.8} 3.8 L ${w - 1.8} 9.8 L 1.8 9.8 Z`}
                fill={`url(#g1-${uid})`}
              />
              <rect x={1.8} y={h - 16.4} width={w - 3.6} height={14.6} fill={soft} />
              <line x1={1.8} y1={h - 16.4} x2={w - 1.8} y2={h - 16.4} stroke={accent} strokeOpacity="0.32" strokeWidth="0.35" />
            </>
          )}
        </>
      )}

      {styleId === 'lanyard-arch' && (
        <>
          <rect width={w} height={h} fill={`url(#gsoft-${uid})`} />
          <g stroke={accent} strokeOpacity="0.07" strokeWidth="0.24" fill="none">
            {[0, 1, 2, 3].map((i) => (
              <circle key={i} cx={w / 2} cy={36} r={16 + i * 6.4} />
            ))}
          </g>
          {!isBack ? (
            <>
              <path d={`M 0 0 L ${w} 0 L ${w} 31.2 Q ${w / 2} 42.5, 0 31.2 Z`} fill={mid} />
              <path d={`M 0 0 L ${w} 0 L ${w} 28.8 Q ${w / 2} 40.0, 0 28.8 Z`} fill={`url(#g1-${uid})`} />
              <circle cx={6} cy={10} r="9" fill="#ffffff" fillOpacity="0.06" />
              <circle cx={w - 5} cy={22} r="7" fill="#ffffff" fillOpacity="0.06" />
              <path d={`M 0 ${h} L ${w} ${h} L ${w} ${h - 4.4} Q ${w / 2} ${h - 7.6}, 0 ${h - 4.4} Z`} fill={`url(#g1-${uid})`} />
            </>
          ) : (
            <>
              <path d={`M 0 0 L ${w} 0 L ${w} 14.5 Q ${w / 2} 19.6, 0 14.5 Z`} fill={`url(#g1-${uid})`} />
              <rect x={0} y={h - 19.8} width={w} height={19.8} fill={soft} />
              <line x1={0} y1={h - 19.8} x2={w} y2={h - 19.8} stroke={accent} strokeOpacity="0.34" strokeWidth="0.34" />
              <rect x={0} y={h - 2.2} width={w} height={2.2} fill={`url(#g1-${uid})`} />
            </>
          )}
        </>
      )}

      {styleId === 'swiss-minimal' && (
        <>
          <rect width={w} height={h} fill="#ffffff" />
          <rect width={w} height={h} fill={`url(#dots-${uid})`} />
          <rect x={0} y={0} width={3.6} height={h} fill={`url(#g1-${uid})`} />
          <rect x={3.6} y={0} width={1.0} height={h} fill={mid} />
          {!isBack ? (
            <>
              <path d={`M ${w - 26} 0 L ${w} 0 L ${w} ${h} L ${w - 26} ${h} Q ${w - 30} ${h / 2}, ${w - 26} 0 Z`} fill={soft} />
              <circle cx={w - 3} cy={3} r="13" fill={mid} fillOpacity="0.65" />
              <circle cx={w - 4} cy={h - 3} r="11" fill={accent} fillOpacity="0.1" />
              <rect x={3.6} y={h - 1.6} width={w - 3.6} height={1.6} fill={`url(#g2-${uid})`} />
            </>
          ) : (
            <>
              <rect x={4.6} y={h - 15.6} width={w - 4.6} height={15.6} fill={soft} />
              <line x1={4.6} y1={h - 15.6} x2={w} y2={h - 15.6} stroke={accent} strokeOpacity="0.32" strokeWidth="0.32" />
              <rect x={4.6} y={h - 1.6} width={w - 4.6} height={1.6} fill={`url(#g2-${uid})`} />
            </>
          )}
        </>
      )}

      {styleId === 'guilloche-net' && (
        <>
          <rect width={w} height={h} fill={`url(#gsoft-${uid})`} />
          <g stroke={accent} strokeOpacity="0.12" strokeWidth="0.22" fill="none">
            {Array.from({ length: 12 }, (_, i) => (
              <path
                key={i}
                d={`M -4 ${i * 7.5} Q ${w * 0.25} ${i * 7.5 - 6}, ${w * 0.5} ${i * 7.5} T ${w + 4} ${i * 7.5}`}
              />
            ))}
          </g>
          <rect x={0} y={0} width={w} height={2.4} fill={`url(#g1-${uid})`} />
          <rect x={0} y={h - 2.4} width={w} height={2.4} fill={`url(#g1-${uid})`} />
        </>
      )}
    </svg>
  );
});
