import type { ReactNode } from 'react';

export type StudioAppId =
  | 'excel-list'
  | 'photo-studio'
  | 'album-designer'
  | 'print-center';

export type WindowSnapPreset =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'tile-two';

export type WindowTileColumns = 2 | 3;

export interface NormalizedWindowBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DockOriginBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SmartWindowLayoutControlState {
  isEnabled: boolean;
  visibleCount: number;
  snapPreset: WindowSnapPreset | null;
  onActivateSmartTile: () => void;
  onResetLayout: () => void;
  onSelectPreset: (preset: WindowSnapPreset) => void;
}

export interface WindowInstanceState {
  appId: StudioAppId;
  title: string;
  subtitle: string;
  accentHex: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  snapPreset: WindowSnapPreset | null;
  layoutBounds: NormalizedWindowBounds | null;
  zIndex: number;
  geometry: WindowGeometry;
}

export interface StudioAppDefinition {
  appId: StudioAppId;
  code: string;
  title: string;
  shortLabel: string;
  subtitle: string;
  accentHex: string;
  defaultGeometry: WindowGeometry;
  icon: ReactNode;
}

export interface PrintCenterHandoff {
  seq: number;
  classId: string;
  layoutKind: 'class-chart' | 'yearbook-spread' | 'id-card';
}
