# Shape Escape: design pillars

What the game is, so every change can be checked against it. The aim is the polish and pull of the best small arcade games, with an identity of its own. It shouldn't be a clone of any of them.

## The one idea

**You are a shape, and you change what you are to fit what's coming.** Everything else exists to make that moment, seeing a shape and becoming it in time, feel great.

## Pillars

1. **The shapes are the characters.** Circle, square and triangle each have a colour and a voice (bell, marimba, plucked string), and they keep them everywhere: falling shapes, the player, the menu, the touch buttons. The morph between them is the signature move and is always animated.
2. **Your catches are the melody.** The soundtrack is a calm, warm bed; the player's catches play the tune on top. Every pitch in the game comes from one pentatonic scale, so nothing the player does can sound wrong. A streak climbs the scale.
3. **Calm surface, intense depth.** Clean, minimal visuals and soft sound. Intensity comes from speed, density and the music building, not from flashes, noise or screen-filling effects.
4. **Fair and readable.** Every shape is catchable with perfect play (tested). Shapes are previewed before they fall and land on the beat. A failed run should always feel like your mistake.
5. **One more go.** Short runs, instant restart, a daily challenge everyone shares.

## Rules that follow

- Sound: only soft waveforms (sine, triangle, plucked string); no square or sawtooth waves, no bright noise. Catch melodies stay between A4 and D6. The music sits under the catches in the mix. New sounds go on `tools/sounds.html` so they can be judged by ear before shipping.
- Colour: shape colours come from `SHAPE_COLORS` (Okabe-Ito, colour-blind safe). The background stays dark and cool; it shifts hue gently as the music builds.
- Motion: things ease in and out; nothing pops or snaps except a wrong-shape death.
- Effects must be cheap (`tools/framepace.html`) and switchable (`game.effects`).

## Deliberately left out

- Borrowed signatures from other games ("Attempt N", white flashes on drops, neon-on-black everything).
- Harsh chiptune or EDM sound.
- Anything unfair: shapes that can't all be caught, hidden hitboxes, random difficulty spikes.

## Open questions

- Is a calm bed the right music, or should the soundtrack get more energetic late in a run?
- Should each shape's voice also play a soft note when you morph into it?
- Levels: handcrafted sequences that you can learn, or keep everything endless and daily?
