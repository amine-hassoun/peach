// Service worker registration (production only) and the Android/desktop install button.
export function registerSW() {
  if (!import.meta.env?.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// iOS has no install event: the README covers Share -> Add to Home Screen.
export function setupInstall(button) {
  let evt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evt = e;
    button.hidden = false;
  });
  button.addEventListener('click', async () => {
    if (!evt) return;
    evt.prompt();
    await evt.userChoice;
    evt = null;
    button.hidden = true;
  });
}
