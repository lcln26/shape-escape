# Shape Escape

Shape Escape is a fast-paced arcade game built with HTML and JavaScript. Morph between circle, square and triangle to catch the shapes that match you, dodge the ones that don't, and keep your energy up. Every shape has its own voice, so your catches play the melody over the soundtrack. See [DESIGN.md](DESIGN.md) for what the game is aiming for.

## 🚀 Features
- **Energy Bar:** Your energy drains constantly and every catch tops it up, so you have to keep catching shapes to stay alive.
- **Your Catches Are the Melody:** Circles ring like bells, squares like a marimba, triangles like a plucked string. Every note is from one scale, so a streak plays a climbing phrase over the soundtrack.
- **Soundtrack:** A calm 128 BPM track generated in code that builds as the run goes on. Shapes land on the beat.
- **Morphing:** Your shape visibly reshapes itself into the next one.
- **Rising Difficulty:** Shapes fall faster and more often the longer you survive.
- **Pause Functionality:** Pause and resume the game at any time using the Escape key. The game also pauses itself if you switch tabs or windows.
- **Improved Dash Mechanics:** Dash in the current or last moved direction using the Space bar.
- **Dynamic Starfield Background:** Enjoy an immersive, animated background.
- **Shield Power-ups:** Collect power-ups that grant temporary protection against mismatches.
- **Persistent High Score Tracking:** Keep track of your highest score across sessions.
- **Combo System:** Build a score multiplier (up to x8) by catching shapes in quick succession.
- **Smooth Morph Animations:** Experience visually appealing transitions between circle, square, and triangle.
- **Colour-Coded Shapes:** Circles, squares and triangles each have their own colour, and so does your shape.
- **Sound:** Generated in code with the Web Audio API. Press **M** to mute everything or **N** to turn just the music off.
- **Achievements:** Eight to unlock, with a notification when you earn one.
- **Designed Patterns:** Streams, sweeps, staircases and more mix in with single shapes as you survive longer. Every shape is catchable with perfect play.
- **Daily Challenge:** The same shapes for everyone each day, with a separate daily best and a result you can copy and share.
- **Touch Controls:** On phones and tablets, on-screen buttons replace the keyboard.
- **Quick Restart:** Press the Space bar after a game over to play again.
- **Fits Any Window:** The game scales to fill the browser window while keeping its 4:3 shape.

## 🎮 How to Play
- **Movement:**  
  - **← / →:** Move left or right.  
  - **Spacebar:** Dash (pulse) in the current/last direction.
- **Morphing:**  
  - Press **1** for Circle  
  - Press **2** for Square  
  - Press **3** for Triangle
- **Pause**
  - Press **Escape** to pause or resume the game.
- **Sound**
  - Press **M** to turn all sound on or off, **N** for just the music.
- **Daily challenge:**
  - Press **D** on the start screen. After a daily run, press **C** to copy your result.
- **Touch screens:**
  - Hold **◀ / ▶** to move, double-tap one to dash, and tap a shape to morph.
- **Restart:**  
  - When you lose, press the **space bar** to play again (after a short pause, so a last-second dash doesn't skip your score), or **Esc** to go back to the menu.
- **Objective:**  
  - Morph into the matching shape and catch falling shapes to refill your energy.
  - Dodge shapes that don't match you; touching one ends the run.
  - Build combo multipliers by catching shapes quickly.
  - Collect shield power-ups to avoid mismatches.
  - Survive as long as possible and beat your high score!

## 💻 Getting Started
The game uses JavaScript modules, which Chrome and other browsers refuse to load from a file opened straight from disk, so serve it over a local web server instead:

1. Clone the repository:
   ```bash
   git clone https://github.com/lcln26/shape-escape.git
   cd shape-escape
   ```
2. Start the dev server:
   ```bash
   npm start
   ```
   (That runs `python3 scripts/serve.py`, which also turns off caching so code changes show up on reload. Any static server works too, e.g. `python3 -m http.server 8000`.)
3. Open **http://localhost:8000** in your browser.

If you change the code while a plain `http.server` is running, hard-refresh (Cmd+Shift+R / Ctrl+Shift+R) so the browser doesn't reuse old files.

Press the **`** (backtick) key in game to toggle a frame meter: frame rate, the worst gap between frames, how many frames missed a refresh (**slow**), the slowest single frame of game code (**max work**), and a graph of recent frames. If frames are slow while max work stays small, the delay is outside the game; **http://localhost:8000/tools/framepace.html** benchmarks the game against an empty page in whatever browser you open it in.

See [ROADMAP.md](ROADMAP.md) for known issues and planned improvements.

Run the tests with `npm install` then `npm test`.

To hear every sound on its own (each shape's voice, the music at each stage, all effects), open **http://localhost:8000/tools/sounds.html**.

To check difficulty tuning, open **http://localhost:8000/tools/balance.html**. It runs simulated players against the game rules and reports how long they survive.

## 💾 Technologies Used
- **HTML5 Canvas:** For rendering graphics.
- **Vanilla JavaScript:** For core gameplay logic.
- **CSS3:** For responsive styling.

## 🤝 Contributing
Contributions are welcome! If you have ideas for improvements or new features, feel free to fork the repository and submit a pull request.

## 🪪 License
This project is licensed under the MIT License. See the **LICENSE** file for details.