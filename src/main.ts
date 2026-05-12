import "./style.css";
import { Game } from "./game/game";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root");
}

const game = new Game(root);
void game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy());
}
