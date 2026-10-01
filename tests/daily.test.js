import { todayKey, dailySeed, shareText, formatTime } from '../js/daily.js';
import { GameMode } from '../js/game.js';
import { makeGame } from './helpers.js';

test('todayKey uses the local date', () => {
  expect(todayKey(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01');
});

test('each day gets its own stable seed', () => {
  expect(dailySeed('2026-10-01')).toBe(dailySeed('2026-10-01'));
  expect(dailySeed('2026-10-01')).not.toBe(dailySeed('2026-10-02'));
});

test('daily runs on the same day share a seed; normal runs do not', () => {
  const game = makeGame();
  game.startRun(GameMode.DAILY);
  const first = game.seed;
  game.startRun(GameMode.DAILY);
  expect(game.seed).toBe(first);
  game.startRun(GameMode.NORMAL);
  const normal = game.seed;
  game.startRun(GameMode.NORMAL);
  expect(game.seed).not.toBe(normal);
});

test('daily scores are kept apart from the normal high score', () => {
  const game = makeGame();
  game.startRun(GameMode.DAILY);
  game.score = 500;
  game.endGame('Out of energy!');
  expect(game.dailyBest).toBe(500);
  expect(game.highScore).toBe(0);
  expect(game.isNewHighScore).toBe(true);
});

test('share text summarises the run', () => {
  expect(formatTime(92.7)).toBe('1:32');
  const text = shareText({ key: '2026-10-01', score: 1240, runTime: 92.7, bestMultiplier: 8, catchesByShape: { circle: 12, square: 9, triangle: 10 } });
  expect(text).toBe('Shape Escape daily 2026-10-01\nScore 1240 · survived 1:32 · best combo x8\n● 12  ■ 9  ▲ 10');
});
