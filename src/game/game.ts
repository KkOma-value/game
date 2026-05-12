import { loadGameAssets, type LoadedAssets } from "./assets";
import { RiftAudio } from "./audio";
import { InputController } from "./input";
import { createInitialModel, resizeModel, startRun, stepModel, summonBoss } from "./model";
import { Renderer } from "./renderer";
import { createSpawnDirector, type SpawnDirector } from "./spawner";
import type { Arena, SpawnEvent } from "./types";

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: InputController;
  private readonly renderer = new Renderer();
  private readonly audio = new RiftAudio();
  private assets: LoadedAssets = { images: {}, missing: [] };
  private model = createInitialModel({ width: 1280, height: 720 });
  private director: SpawnDirector = createSpawnDirector(7001);
  private lastTime = 0;
  private spawnTimer = 0;
  private running = false;

  constructor(private readonly root: HTMLElement) {
    root.className = "game-shell";
    this.canvas = document.createElement("canvas");
    root.append(this.canvas);

    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable");
    }
    this.ctx = ctx;
    this.input = new InputController(this.canvas);

    window.addEventListener("resize", this.resize);
    this.resize();
  }

  async start() {
    this.assets = await loadGameAssets();
    this.renderAssetWarning();
    this.running = true;
    requestAnimationFrame(this.tick);
  }

  destroy() {
    this.running = false;
    this.input.dispose();
    window.removeEventListener("resize", this.resize);
  }

  private tick = (time: number) => {
    if (!this.running) return;

    const dt = this.lastTime === 0 ? 0 : (time - this.lastTime) / 1000;
    this.lastTime = time;

    if (this.input.consumeStartRequest()) {
      this.audio.resume();
      if (this.model.phase === "title" || this.model.phase === "win" || this.model.phase === "gameover") {
        startRun(this.model);
        this.director = createSpawnDirector(Math.floor(time) + 7001);
        this.spawnTimer = 0.3;
      }
    }

    if (this.input.consumeBossSummonRequest()) {
      summonBoss(this.model);
    }

    const playable = this.model.phase === "playing" || this.model.phase === "boss";
    let events: SpawnEvent[] = [];
    if (playable) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        events = this.director.plan(this.model.elapsed, this.model.arena, this.model.player.position, this.model.phase === "boss");
        const interval = this.model.phase === "boss" ? 5.2 : Math.max(1.35, 3.25 - this.model.elapsed / 76);
        this.spawnTimer = interval;
      }
      stepModel(this.model, dt, this.input.frame(), events);
      this.audio.update(this.model.score, this.model.player.health, this.model.phase);
    }

    this.renderer.draw(this.ctx, this.model, { assets: this.assets, touch: this.input.touchHud() });
    requestAnimationFrame(this.tick);
  };

  private resize = () => {
    const width = Math.max(360, window.innerWidth);
    const height = Math.max(520, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const arena: Arena = { width, height };
    resizeModel(this.model, arena);
  };

  private renderAssetWarning() {
    const existing = this.root.querySelector(".asset-warning");
    existing?.remove();

    if (this.assets.missing.length === 0) {
      return;
    }

    const warning = document.createElement("div");
    warning.className = "asset-warning";
    warning.textContent = `Imagegen asset pass pending: ${this.assets.missing.length} bitmap files are missing from /public/assets. The game is running with in-memory debug silhouettes until those files are generated.`;
    this.root.append(warning);
  }
}
