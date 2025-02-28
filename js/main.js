import { GAME_WIDTH, GAME_HEIGHT, dpr } from "./config.js";
import { Game } from "./game.js";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = GAME_WIDTH * dpr;
canvas.height = GAME_HEIGHT * dpr;
canvas.style.width = GAME_WIDTH + "px";
canvas.style.height = GAME_HEIGHT + "px";
ctx.scale(dpr, dpr);

const game = new Game(canvas, ctx);
game.drawStartMenu();
