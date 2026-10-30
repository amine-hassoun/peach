// Planner: "if I enter on X, how long can I stay?" DOM-built (textContent only), so no escaping needed.
// Mount once; call refresh() from render() so results follow stay edits.
export function mountPlanner(root, { getStays, today, maxStay, t = (k) => k, formatDate = (s) => s }) {
  const tr = (key, fallback) => {
    const v = t(key);
    return v && v !== key ? v : fallback;
  };

  root.textContent = '';
  const card = document.createElement('div');
  card.className = 'card planner';

  const h = document.createElement('h2');
  h.textContent = tr('planner.title', 'Trip planner');

  const label = document.createElement('label');
  label.textContent = tr('planner.entryLabel', 'If I enter on');
  const input = document.createElement('input');
  input.type = 'date';
  input.min = today();
  label.append(' ', input);

  const out = document.createElement('p');
  out.className = 'planner-result';
  out.setAttribute('aria-live', 'polite');

  card.append(h, label, out);
  root.append(card);

  function refresh() {
    input.min = today();
    if (!input.value) {
      out.textContent = tr('planner.hint', 'Pick an entry date to see how long you can stay.');
      return;
    }
    const r = maxStay(getStays(), input.value, today());
    if (!r || r.days <= 0) {
      out.textContent = tr('planner.none', 'No days available if you enter on that date.');
      return;
    }
    out.textContent = tr('planner.result', 'You can stay up to {n} days, until {date}.')
      .replace('{n}', String(r.days))
      .replace('{date}', formatDate(r.lastDay));
  }

  input.addEventListener('input', refresh);
  refresh();
  return { refresh };
}
