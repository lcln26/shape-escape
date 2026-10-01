# Shape Escape

Shape Escape is a fast-paced, minimalist arcade game built with HTML and JavaScript. Control your shape, morph to match falling obstacles, dash to reach distant targets, and now—try to beat your high score within a session!

## 🚀 Features
- **Energy Bar:** Your energy drains constantly and every catch tops it up, so you have to keep catching shapes to stay alive.
- **Rising Difficulty:** Shapes fall faster and more often the longer you survive.
- **Pause Functionality:** Pause and resume the game at any time using the Escape key. The game also pauses itself if you switch tabs or windows.
- **Improved Dash Mechanics:** Dash in the current or last moved direction using the Space bar.
- **Dynamic Starfield Background:** Enjoy an immersive, animated background.
- **Shield Power-ups:** Collect power-ups that grant temporary protection against mismatches.
- **Persistent High Score Tracking:** Keep track of your highest score across sessions.
- **Combo System:** Build a score multiplier (up to x8) by catching shapes in quick succession.
- **Smooth Morph Animations:** Experience visually appealing transitions between circle, square, and triangle.
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
- **Restart:**  
  - When you lose, press the **space bar** to play again (after a short pause, so a last-second dash doesn't skip your score).
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
2. Start a local server (either works):
   ```bash
   python3 -m http.server 8000
   ```
   ```bash
   npx serve -l 8000
   ```
3. Open **http://localhost:8000** in your browser.

If you change the code while a plain `http.server` is running, hard-refresh (Cmd+Shift+R / Ctrl+Shift+R) so the browser doesn't reuse old files.

Press the **`** (backtick) key in game to toggle a frame meter showing frame rate, the worst frame gap, and time spent per frame.

See [ROADMAP.md](ROADMAP.md) for known issues and planned improvements.

## 💾 Technologies Used
- **HTML5 Canvas:** For rendering graphics.
- **Vanilla JavaScript:** For core gameplay logic.
- **CSS3:** For responsive styling.

## 🤝 Contributing
Contributions are welcome! If you have ideas for improvements or new features, feel free to fork the repository and submit a pull request.

## 🪪 License
This project is licensed under the MIT License. See the **LICENSE** file for details.