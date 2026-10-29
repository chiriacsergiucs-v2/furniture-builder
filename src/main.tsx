// First: the chosen language, before any module makes its texts (ADR-153).
import './langInit';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
// Barlow has no Cyrillic: Fira Sans covers Russian text, loaded only for those letters (ADR-153).
import '@fontsource/fira-sans/cyrillic-400.css';
import '@fontsource/fira-sans/cyrillic-500.css';
import '@fontsource/fira-sans/cyrillic-600.css';
import '@fontsource/fira-sans-condensed/cyrillic-500.css';
import '@fontsource/fira-sans-condensed/cyrillic-600.css';
import './styles.css';
import { App } from './ui/App';
import { t } from './core/i18n';
import { applyTheme } from './ui/useTheme';
import { installCutTitles } from './ui/cutTitle';
import { registerSW } from 'virtual:pwa-register';

applyTheme();
installCutTitles();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support. New versions wait for the user instead of reloading mid-edit.
const updateSW = registerSW({
  onNeedRefresh() {
    const bar = document.createElement('div');
    bar.className = 'toast';
    bar.setAttribute('role', 'status');
    const msg = document.createElement('span');
    msg.textContent = t('A new version is ready.');
    bar.append(msg);
    const btn = Object.assign(document.createElement('button'), {
      textContent: t('Update now'),
      type: 'button',
      className: 'btn primary sm',
    });
    btn.onclick = () => updateSW(true);
    bar.append(btn);
    document.body.append(bar);
  },
});
