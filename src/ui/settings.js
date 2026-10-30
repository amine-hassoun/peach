// Settings: sync status, copy/paste personal link, JSON export/import. DOM-built, textContent only.
export function mountSettings(root, { persistence, t = (k) => k, origin = globalThis.location?.origin ?? '' }) {
  const tr = (key, fallback) => {
    const v = t(key);
    return v && v !== key ? v : fallback;
  };
  const STATUS = {
    idle: tr('sync.idle', 'Starting…'),
    syncing: tr('sync.syncing', 'Syncing…'),
    synced: tr('sync.synced', 'Synced'),
    offline: tr('sync.offline', 'Offline: changes are saved on this device'),
    error: tr('sync.error', 'Sync problem: will retry'),
    nolink: tr('sync.nolink', 'Not linked: paste your personal link below'),
    unauthorized: tr('sync.unauthorized', 'This link is not valid anymore'),
  };
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...kids);
    return n;
  };

  root.textContent = '';
  const card = el('div', { className: 'card settings' });
  const title = el('h2', { textContent: tr('settings.title', 'Sync & backup') });
  const status = el('p', { className: 'sync-status', role: 'status' });
  const msg = el('p', { className: 'settings-msg', role: 'status' });

  const copyBtn = el('button', { type: 'button', textContent: tr('settings.copyLink', 'Copy my link') });
  copyBtn.addEventListener('click', async () => {
    const link = persistence.getLink(origin);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      msg.textContent = tr('settings.copied', 'Link copied');
    } catch {
      msg.textContent = tr('settings.copyFailed', 'Could not copy');
    }
  });

  const paste = el('input', {
    type: 'text',
    placeholder: tr('settings.pastePlaceholder', 'Paste your personal link'),
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: false,
  });
  const pasteBtn = el('button', { type: 'button', textContent: tr('settings.linkDevice', 'Link this device') });
  pasteBtn.addEventListener('click', () => {
    const ok = persistence.setLink(paste.value);
    msg.textContent = ok ? tr('settings.linked', 'Device linked') : tr('settings.badLink', 'That does not look like a valid link');
    if (ok) paste.value = '';
    updateVisibility();
  });

  const exportBtn = el('button', { type: 'button', textContent: tr('settings.export', 'Export backup') });
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([persistence.exportJSON()], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'peach-backup.json' });
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const file = el('input', { type: 'file', accept: 'application/json,.json' });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const n = persistence.importJSON(await f.text());
      msg.textContent = tr('settings.imported', 'Imported {n} stays').replace('{n}', String(n));
    } catch (e) {
      msg.textContent = e.message;
    }
    file.value = '';
  });

  card.append(title, status, copyBtn, paste, pasteBtn, exportBtn, file, msg);
  root.append(card);

  function updateVisibility() {
    copyBtn.hidden = !persistence.hasLink();
  }
  function setStatus(s) {
    status.textContent = STATUS[s] ?? s;
    updateVisibility();
  }
  persistence.subscribe(setStatus);
  return { setStatus };
}
