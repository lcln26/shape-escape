export const achievements = [
  {
    id: 'survive_60',
    title: 'Survivor',
    description: 'Survive for 60 seconds in one run',
    condition: (game) => game.runTime >= 60
  },
  {
    id: 'shield_collector',
    title: 'Shield Collector',
    description: 'Collect 5 shields in one run',
    condition: (game) => game.shieldsCollected >= 5
  }
];
