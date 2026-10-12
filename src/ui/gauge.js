import { LIMIT } from '../lib/schengen.js';
import { esc } from '../lib/html.js';

const R = 52;
export const CIRCUMFERENCE = 2 * Math.PI * R;

// Colour shifts as days run low. Never a harsh red: 'low' is a soft rose.
export function gaugeLevel(used) {
  const ratio = used / LIMIT;
  if (ratio < 0.6) return 'ok';
  if (ratio < 0.85) return 'warn';
  return 'low';
}

export function renderGauge({ used, left, label, aria }) {
  const ratio = Math.min(used / LIMIT, 1);
  const offset = CIRCUMFERENCE * (1 - ratio);
  // With 0 days used there is nothing to draw (a zero-length round cap would show as a dot).
  const value =
    used > 0
      ? `<circle class="gauge__value" cx="60" cy="60" r="${R}" transform="rotate(-90 60 60)"
           stroke-dasharray="${CIRCUMFERENCE.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" />`
      : '';
  return `<svg class="gauge gauge--${gaugeLevel(used)}" viewBox="0 0 120 120" role="img" aria-label="${esc(aria)}">
    <circle class="gauge__track" cx="60" cy="60" r="${R}" />
    ${value}
    <text class="gauge__num" x="60" y="62" text-anchor="middle">${left}</text>
    <text class="gauge__label" x="60" y="80" text-anchor="middle">${esc(label)}</text>
  </svg>`;
}
