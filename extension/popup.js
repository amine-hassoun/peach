const out = document.getElementById('out');

document.getElementById('capture').addEventListener('click', async () => {
  out.textContent = 'Capturing…';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'PEACH_CAPTURE' });
    out.textContent = res.ok
      ? JSON.stringify(
          { ...res.job, description: res.job.description.slice(0, 300) + '…' },
          null,
          2
        )
      : `❌ ${res.error}`;
  } catch {
    out.textContent = '❌ No content script here: not a LinkedIn jobs page, or reload the tab.';
  }
});