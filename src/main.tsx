import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import './styles.css';
import { App } from './ui/App';
import { applyTheme } from './ui/useTheme';
import { registerSW } from 'virtual:pwa-register';

applyTheme();
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
    bar.innerHTML = '<span>A new version is ready.</span>';
    const btn = Object.assign(document.createElement('button'), {
      textContent: 'Update now',
      type: 'button',
      className: 'btn primary sm',
    });
    btn.onclick = () => updateSW(true);
    bar.append(btn);
    document.body.append(bar);
  },
});
