// Daily challenge: everyone playing on the same (local) date gets the same
// seed, so the same shapes and patterns in the same order.

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// FNV-1a hash of the date string, so consecutive days get unrelated seeds.
export function dailySeed(key) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function loadDailyBest(key) {
  try {
    return parseInt(localStorage.getItem(`dailyBest:${key}`)) || 0;
  } catch {
    return 0;
  }
}

export function saveDailyBest(key, score) {
  try {
    localStorage.setItem(`dailyBest:${key}`, score);
  } catch {
    // Storage unavailable; the best just won't persist.
  }
}

export function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function shareText({ key, score, runTime, bestMultiplier, catchesByShape }) {
  const { circle = 0, square = 0, triangle = 0 } = catchesByShape;
  return [
    `Shape Escape daily ${key}`,
    `Score ${score} · survived ${formatTime(runTime)} · best combo x${bestMultiplier}`,
    `● ${circle}  ■ ${square}  ▲ ${triangle}`,
  ].join('\n');
}
