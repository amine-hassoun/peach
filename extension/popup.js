const out = document.getElementById('out');

async function send(job) {
  const res = await fetch(PEACH_CONFIG.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-peach-key': PEACH_CONFIG.key },
    body: JSON.stringify({ jobs: [job] }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function summarize({ status, body }) {
  if (status === 401) return '❌ Server rejected the key (check config.js)';
  if (status !== 200) return `❌ Server error (${status})`;
  if (body.stored) return '✅ Saved';
  if (body.duplicates) return '↺ Already captured';
  return '⚠️ Server rejected the posting (failed validation)';
}

document.getElementById('capture').addEventListener('click', async () => {
  out.textContent = 'Capturing…';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { type: 'PEACH_CAPTURE' });
  } catch (err) {
    out.textContent = `❌ ${err.message}\nNo content script here: not a LinkedIn jobs page, or reload the tab.`;
    return;
  }
  if (!res.ok) {
    out.textContent = `❌ ${res.error}`;
    return;
  }

  out.textContent = `Sending "${res.job.title}"…`;
  try {
    const result = await send(res.job);
    out.textContent = `${summarize(result)}\n${res.job.title} — ${res.job.company}\njobId ${res.job.jobId}`;
  } catch (err) {
    out.textContent = `❌ Network error: ${err.message}`;
  }
});