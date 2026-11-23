import React from 'react';
import { TABLE_CHUNK_SIZE } from './useInfiniteTableSlice';
import './table-skeleton.css';

export type TableSkeletonVariant = 'students' | 'schools' | 'compact';

const COL1_WIDTHS = ['74%', '62%', '84%', '68%', '88%', '64%', '78%', '72%'] as const;
const COL2_WIDTHS = ['64%', '78%', '58%', '72%', '82%', '60%', '68%', '76%'] as const;
const FILE_WIDTHS = ['72%', '64%', '80%', '68%', '76%', '60%', '74%', '66%'] as const;

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: 20'li Apple Pro Tablo Kutucuk İskelet Yükleyici (TableSkeletonBoxes)
 * - Gerçek tablo hücre ızgarası (`border-right` / `border-bottom`) ile birebir hizalıdır.
 * - GPU-hızlandırmalı (`translate3d`) Apple macOS grafit/gümüş speküler parıltı (shimmer) kullanır.
 * - Şube/okul geçişlerinde ağır portre decode işlemini erteleyerek 60/120fps akıcılık sağlar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const TableSkeletonBoxes: React.FC<{
  variant?: TableSkeletonVariant;
  rows?: number;
  overlay?: boolean;
}> = React.memo(({ variant = 'students', rows = TABLE_CHUNK_SIZE, overlay = false }) => {
  const indices = Array.from({ length: rows }, (_, i) => i);

  return (
    <div
      className={`xl-skeleton-layer ${overlay ? 'is-overlay' : ''}`.trim()}
      aria-hidden="true"
      data-testid={`table-skeleton-${variant}`}
    >
      {indices.map((idx) => {
        const w1 = COL1_WIDTHS[idx % COL1_WIDTHS.length];
        const w2 = COL2_WIDTHS[idx % COL2_WIDTHS.length];
        const wf = FILE_WIDTHS[idx % FILE_WIDTHS.length];

        if (variant === 'schools') {
          return (
            <div key={idx} className="xl-skeleton-row is-schools">
              <span className="xl-sk-cell is-center">
                <span className="xl-sk-bone is-circle" />
              </span>
              <span className="xl-sk-cell">
                <span className="xl-sk-bone is-code" />
              </span>
              <span className="xl-sk-cell">
                <span className="xl-sk-bone" style={{ width: '68%' }} />
              </span>
              <span className="xl-sk-cell">
                <span className="xl-sk-bone is-strong" style={{ width: w1 }} />
              </span>
              <span className="xl-sk-cell">
                <span className="xl-sk-bone" style={{ width: w2 }} />
              </span>
              <span className="xl-sk-cell">
                <span className="xl-sk-bone" style={{ width: wf }} />
              </span>
              <span className="xl-sk-cell is-right">
                <span className="xl-sk-bone is-num" />
              </span>
              <span className="xl-sk-cell is-right">
                <span className="xl-sk-bone is-num-wide" />
              </span>
              <span className="xl-sk-cell is-center">
                <span className="xl-sk-actions">
                  <span className="xl-sk-bone is-icon-btn" />
                  <span className="xl-sk-bone is-icon-btn" />
                </span>
              </span>
            </div>
          );
        }

        if (variant === 'compact') {
          return (
            <div key={idx} className="xl-skeleton-row is-compact">
              <span className="xl-sk-cell is-center">
                <span className="xl-sk-bone is-sn" />
              </span>
              <span className="xl-sk-cell">
                <span className="xl-sk-bone is-badge" />
              </span>
              <span className="xl-sk-cell">
                <span className="xl-sk-bone is-strong" style={{ width: w1 }} />
              </span>
              <span className="xl-sk-cell">
                <span className="xl-sk-bone" style={{ width: w2 }} />
              </span>
            </div>
          );
        }

        return (
          <div key={idx} className="xl-skeleton-row is-students">
            <span className="xl-sk-cell is-center">
              <span className="xl-sk-bone is-circle" />
            </span>
            <span className="xl-sk-cell is-center">
              <span className="xl-sk-bone is-sn" />
            </span>
            <span className="xl-sk-cell">
              <span className="xl-sk-bone is-badge" />
            </span>
            <span className="xl-sk-cell">
              <span className="xl-sk-bone is-strong" style={{ width: w1 }} />
            </span>
            <span className="xl-sk-cell">
              <span className="xl-sk-bone is-strong" style={{ width: w2 }} />
            </span>
            <span className="xl-sk-cell is-center">
              <span className="xl-sk-bone is-portrait" />
            </span>
            <span className="xl-sk-cell">
              <span className="xl-sk-file">
                <span className="xl-sk-bone is-mini-icon" />
                <span className="xl-sk-bone" style={{ width: wf }} />
              </span>
            </span>
            <span className="xl-sk-cell is-center">
              <span className="xl-sk-bone is-circle" />
            </span>
            <span className="xl-sk-cell is-center">
              <span className="xl-sk-bone is-group" />
            </span>
            <span className="xl-sk-cell">
              <span className="xl-sk-bone is-status" />
            </span>
            <span className="xl-sk-cell is-center">
              <span className="xl-sk-actions">
                <span className="xl-sk-bone is-icon-btn" />
                <span className="xl-sk-bone is-icon-btn" />
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
});

