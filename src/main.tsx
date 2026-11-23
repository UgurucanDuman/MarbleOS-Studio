import { createRoot } from 'react-dom/client';
import { StudioQueryProvider } from './system/query/StudioQueryProvider';
import './index.css';
import './system/theme/theme-palettes.css';
import App from './App.tsx';
import { installMotionDiagnostics } from './system/motion/motionDiagnostics';
import { startDesktopPersonalization } from './system/desktop/desktopPersonalization';
import { installScrollIndicators } from './system/desktop/scrollIndicators';
import { startDesktopWorkspace } from './system/sqlite/studioDatabase';
import { startDesktopLicense } from './system/desktop/desktopLicense';

const root = document.getElementById('root')!;
const disposeScrollIndicators = installScrollIndicators(root);

if (import.meta.env.DEV) {
  const disposeDiagnostics = installMotionDiagnostics();
  import.meta.hot?.dispose(disposeDiagnostics);
  import.meta.hot?.dispose(disposeScrollIndicators);
}

// Lisans Rust tarafında doğrulanmadan yerel veri deposu açılmaz.
void startDesktopLicense().then((licensed) => {
  if (licensed) void startDesktopWorkspace();
});
void startDesktopPersonalization();
createRoot(root).render(
  <StudioQueryProvider>
    <App />
  </StudioQueryProvider>,
);
