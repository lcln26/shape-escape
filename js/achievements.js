import { MAX_COMBO_MULTIPLIER } from "./config.js";

// Conditions are checked every frame against the current run.
export const achievements = [
  {
    id: 'survive_60',
    title: 'Survivor',
    description: 'Survive for 60 seconds in one run',
    condition: (game) => game.runTime >= 60
  },
  {
    id: 'survive_120',
    title: 'Endurance',
    description: 'Survive for 2 minutes in one run',
    condition: (game) => game.runTime >= 120
  },
  {
    id: 'catches_50',
    title: 'Collector',
    description: 'Catch 50 shapes in one run',
    condition: (game) => game.catches >= 50
  },
  {
    id: 'max_combo',
    title: 'On Fire',
    description: 'Reach the maximum combo multiplier',
    condition: (game) => game.getComboMultiplier() >= MAX_COMBO_MULTIPLIER
  },
  {
    id: 'score_1000',
    title: 'Four Digits',
    description: 'Score 1,000 points in one run',
    condition: (game) => game.score >= 1000
  },
  {
    id: 'score_5000',
    title: 'High Roller',
    description: 'Score 5,000 points in one run',
    condition: (game) => game.score >= 5000
  },
  {
    id: 'close_call',
    title: 'Close Call',
    description: 'Catch a shape with less than 10% energy left',
    condition: (game) => game.closeCalls > 0
  },
  {
    id: 'shield_collector',
    title: 'Shield Collector',
    description: 'Collect 5 shields in one run',
    condition: (game) => game.shieldsCollected >= 5
  }
];
