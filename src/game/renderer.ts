import type { AssetKey, LoadedAssets } from "./assets";
import type { TouchHudState } from "./input";
import type { GameModel } from "./types";
import { clamp } from "./vector";

type DrawOptions = {
  assets: LoadedAssets;
  touch: TouchHudState;
};

const assetForEnemy = {
  chaser: "enemyChaser",
  drifter: "enemyDrifter",
  orbiter: "enemyOrbiter",
} as const;

export class Renderer {
  private backgroundOffset = 0;

  draw(ctx: CanvasRenderingContext2D, model: GameModel, options: DrawOptions) {
    this.backgroundOffset = (this.backgroundOffset + 0.35) % 10000;
    ctx.save();
    ctx.clearRect(0, 0, model.arena.width, model.arena.height);

    if (model.shake > 0) {
      ctx.translate((Math.random() - 0.5) * model.shake * 18, (Math.random() - 0.5) * model.shake * 18);
    }

    this.drawBackground(ctx, model, options.assets);
    this.drawWorld(ctx, model, options.assets);
    ctx.restore();

    this.drawHud(ctx, model, options.assets);
    this.drawBossSummonButton(ctx, model);
    this.drawTouchControls(ctx, options.touch, model.arena.width, model.arena.height);

    if (model.phase === "title") {
      this.drawTitle(ctx, model, options.assets);
    } else if (model.phase === "gameover" || model.phase === "win") {
      this.drawEndState(ctx, model);
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D, model: GameModel, assets: LoadedAssets) {
    const image = assets.images.riftBackground;
    if (image) {
      const pattern = ctx.createPattern(image, "repeat");
      if (pattern) {
        ctx.save();
        const rawX = this.backgroundOffset * -0.6;
        const rawY = this.backgroundOffset * 0.9;
        const imgW = image.naturalWidth || 512;
        const imgH = image.naturalHeight || 512;
        const wrappedX = ((rawX % imgW) + imgW) % imgW;
        const wrappedY = ((rawY % imgH) + imgH) % imgH;
        ctx.translate(wrappedX - imgW, wrappedY - imgH);
        ctx.fillStyle = pattern;
        ctx.fillRect(-imgW * 2, -imgH * 2, model.arena.width + imgW * 4, model.arena.height + imgH * 4);
        ctx.restore();
      }
    } else {
      const gradient = ctx.createRadialGradient(
        model.arena.width / 2,
        model.arena.height / 2,
        40,
        model.arena.width / 2,
        model.arena.height / 2,
        Math.max(model.arena.width, model.arena.height) * 0.7,
      );
      gradient.addColorStop(0, "#13353b");
      gradient.addColorStop(0.45, "#071117");
      gradient.addColorStop(1, "#080605");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, model.arena.width, model.arena.height);

      ctx.strokeStyle = "rgba(64, 237, 255, 0.12)";
      ctx.lineWidth = 1;
      for (let i = -model.arena.height; i < model.arena.width; i += 58) {
        ctx.beginPath();
        ctx.moveTo(i + (this.backgroundOffset % 58), 0);
        ctx.lineTo(i + model.arena.height + (this.backgroundOffset % 58), model.arena.height);
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(82, 244, 255, 0.28)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      const radius = 90 + i * 86 + Math.sin(this.backgroundOffset * 0.02 + i) * 18;
      ctx.beginPath();
      ctx.ellipse(model.arena.width / 2, model.arena.height / 2, radius * 1.9, radius, this.backgroundOffset * 0.002, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawWorld(ctx: CanvasRenderingContext2D, model: GameModel, assets: LoadedAssets) {
    for (const mine of model.mines) {
      const warning = 58 + Math.sin(mine.pulse * 10) * 6;
      ctx.save();
      ctx.globalAlpha = mine.armed <= 0.15 ? 0.42 : 0.2;
      ctx.strokeStyle = "#ff7a2d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mine.position.x, mine.position.y, warning, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      this.drawAsset(ctx, assets, "hazardMine", mine.position.x, mine.position.y, 58, mine.pulse, () =>
        this.fallbackMine(ctx, mine.position.x, mine.position.y, 29, mine.pulse),
      );
    }

    for (const core of model.cores) {
      const size = 42 + Math.sin(core.pulse * 7) * 4;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(87, 243, 255, 0.16)";
      ctx.beginPath();
      ctx.arc(core.position.x, core.position.y, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.drawAsset(ctx, assets, "energyCore", core.position.x, core.position.y, size, core.pulse, () =>
        this.fallbackCore(ctx, core.position.x, core.position.y, size / 2, core.pulse),
      );
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const projectile of model.projectiles) {
      ctx.fillStyle = "#ffb14f";
      ctx.beginPath();
      ctx.arc(projectile.position.x, projectile.position.y, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const proj of model.playerProjectiles) {
      ctx.fillStyle = "#57edff";
      ctx.beginPath();
      ctx.arc(proj.position.x, proj.position.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const enemy of model.enemies) {
      this.drawAsset(ctx, assets, assetForEnemy[enemy.type], enemy.position.x, enemy.position.y, enemy.radius * 2.6, enemy.phase, () =>
        this.fallbackEnemy(ctx, enemy.position.x, enemy.position.y, enemy.radius, enemy.type, enemy.phase),
      );
    }

    if (model.boss) {
      ctx.save();
      ctx.globalAlpha = 0.34 + Math.sin(model.boss.timer * 5) * 0.08;
      ctx.strokeStyle = "#ff8732";
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(model.boss.position.x, model.boss.position.y, model.boss.radius + 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      this.drawAsset(ctx, assets, "boss", model.boss.position.x, model.boss.position.y, model.boss.radius * 2.6, model.boss.timer * 0.25, () =>
        this.fallbackBoss(ctx, model.boss!.position.x, model.boss!.position.y, model.boss!.radius, model.boss!.timer),
      );
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const particle of model.particles) {
      const alpha = 1 - particle.life / particle.ttl;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.position.x, particle.position.y, particle.radius * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const playerAlpha = model.player.invulnerable > 0 && Math.floor(model.player.invulnerable * 18) % 2 === 0 ? 0.48 : 1;
    ctx.save();
    ctx.globalAlpha = playerAlpha;
    if (model.player.boostTrail > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(73, 240, 255, 0.24)";
      ctx.beginPath();
      ctx.ellipse(model.player.position.x, model.player.position.y + 18, 20, 42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawAsset(ctx, assets, "player", model.player.position.x, model.player.position.y, 70, 0, () =>
      this.fallbackPlayer(ctx, model.player.position.x, model.player.position.y),
    );
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, model: GameModel, assets: LoadedAssets) {
    if (model.arena.width < 700) {
      this.drawCompactHud(ctx, model, assets);
      return;
    }

    const padding = 20;
    ctx.save();
    ctx.fillStyle = "rgba(5, 10, 13, 0.64)";
    ctx.strokeStyle = "rgba(111, 238, 255, 0.25)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, padding, padding, 330, 88, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#d9f9ff";
    ctx.font = "700 20px Bahnschrift, Segoe UI, sans-serif";
    ctx.fillText("RIFT SALVAGE", padding + 18, padding + 30);
    ctx.font = "500 13px Bahnschrift, Segoe UI, sans-serif";
    ctx.fillStyle = "#87bfc6";
    ctx.fillText(model.banner, padding + 18, padding + 52);
    ctx.fillStyle = "#ffb463";
    ctx.fillText(`SCORE ${model.score.toString().padStart(5, "0")}`, padding + 18, padding + 73);

    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < model.player.health ? "#ff7a2d" : "rgba(255, 122, 45, 0.18)";
      ctx.fillRect(padding + 235 + i * 26, padding + 18, 18, 18);
    }

    const chargeWidth = Math.min(240, model.arena.width - 42);
    const chargeX = model.arena.width - chargeWidth - padding;
    ctx.fillStyle = "rgba(5, 10, 13, 0.64)";
    this.roundRect(ctx, chargeX, padding, chargeWidth, 68, 8);
    ctx.fill();
    this.drawAsset(ctx, assets, "goalToken", chargeX + 28, padding + 34, 34, model.elapsed, () =>
      this.fallbackCore(ctx, chargeX + 28, padding + 34, 15, model.elapsed),
    );
    ctx.fillStyle = "#bdeff5";
    ctx.font = "700 13px Bahnschrift, Segoe UI, sans-serif";
    ctx.fillText("ANCHOR CHARGE", chargeX + 54, padding + 28);
    ctx.fillStyle = "rgba(99, 237, 255, 0.18)";
    ctx.fillRect(chargeX + 54, padding + 41, chargeWidth - 74, 9);
    ctx.fillStyle = "#57edff";
    ctx.fillRect(chargeX + 54, padding + 41, (chargeWidth - 74) * (model.bossCharge / 100), 9);

    const remaining = Math.max(0, 180 - model.elapsed);
    ctx.fillStyle = "#ffcf9d";
    ctx.fillText(`${Math.floor(remaining / 60)}:${Math.floor(remaining % 60).toString().padStart(2, "0")}`, chargeX + chargeWidth - 54, padding + 28);
    ctx.restore();
  }

  private drawCompactHud(ctx: CanvasRenderingContext2D, model: GameModel, assets: LoadedAssets) {
    const padding = 14;
    const width = model.arena.width - padding * 2;
    ctx.save();
    ctx.fillStyle = "rgba(5, 10, 13, 0.68)";
    ctx.strokeStyle = "rgba(111, 238, 255, 0.25)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, padding, padding, width, 96, 8);
    ctx.fill();
    ctx.stroke();

    this.drawAsset(ctx, assets, "warningIcon", padding + 24, padding + 27, 26, model.elapsed, () => {
      ctx.fillStyle = "#ff7a2d";
      ctx.fillRect(padding + 14, padding + 17, 20, 20);
    });
    ctx.fillStyle = "#d9f9ff";
    ctx.font = "800 18px Bahnschrift, Segoe UI, sans-serif";
    ctx.fillText("RIFT SALVAGE", padding + 44, padding + 29);
    ctx.fillStyle = "#ffb463";
    ctx.font = "700 13px Bahnschrift, Segoe UI, sans-serif";
    ctx.fillText(`SCORE ${model.score.toString().padStart(5, "0")}`, padding + 44, padding + 51);

    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < model.player.health ? "#ff7a2d" : "rgba(255, 122, 45, 0.18)";
      ctx.fillRect(model.arena.width - padding - 78 + i * 24, padding + 18, 16, 16);
    }

    const remaining = Math.max(0, 180 - model.elapsed);
    ctx.fillStyle = "#ffcf9d";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.floor(remaining / 60)}:${Math.floor(remaining % 60).toString().padStart(2, "0")}`, model.arena.width - padding - 12, padding + 55);
    ctx.textAlign = "left";

    ctx.fillStyle = "#87bfc6";
    ctx.font = "600 11px Bahnschrift, Segoe UI, sans-serif";
    ctx.fillText("ANCHOR CHARGE", padding + 14, padding + 75);
    ctx.fillStyle = "rgba(99, 237, 255, 0.18)";
    ctx.fillRect(padding + 116, padding + 67, width - 132, 10);
    ctx.fillStyle = "#57edff";
    ctx.fillRect(padding + 116, padding + 67, (width - 132) * (model.bossCharge / 100), 10);
    ctx.restore();
  }

  private drawTitle(ctx: CanvasRenderingContext2D, model: GameModel, assets: LoadedAssets) {
    ctx.save();
    ctx.fillStyle = "rgba(3, 7, 9, 0.54)";
    ctx.fillRect(0, 0, model.arena.width, model.arena.height);
    const centerX = model.arena.width / 2;
    const centerY = model.arena.height / 2;
    this.drawAsset(ctx, assets, "titleBadge", centerX, centerY - 118, 180, 0, () => this.fallbackBadge(ctx, centerX, centerY - 118));
    this.fitText(ctx, "RIFT SALVAGE", centerX, centerY - 12, model.arena.width - 36, 58, 34, "900", "#e8fbff");
    this.fitText(
      ctx,
      "RECOVER CORES. EVADE THE COLLAPSE. SURVIVE THE ANCHOR.",
      centerX,
      centerY + 28,
      model.arena.width - 42,
      18,
      12,
      "700",
      "#ffb463",
    );
    this.fitText(
      ctx,
      "WASD / ARROWS to pilot    SPACE / SHIFT to boost    TAP to launch",
      centerX,
      centerY + 78,
      model.arena.width - 42,
      15,
      11,
      "500",
      "#9bd6dd",
    );
    ctx.restore();
  }

  private drawEndState(ctx: CanvasRenderingContext2D, model: GameModel) {
    ctx.save();
    ctx.fillStyle = "rgba(3, 7, 9, 0.62)";
    ctx.fillRect(0, 0, model.arena.width, model.arena.height);
    ctx.textAlign = "center";
    ctx.fillStyle = model.phase === "win" ? "#8fffe9" : "#ff7a2d";
    ctx.font = "900 52px Bahnschrift, Segoe UI, sans-serif";
    ctx.fillText(model.phase === "win" ? "RIFT STABILIZED" : "DRONE LOST", model.arena.width / 2, model.arena.height / 2 - 18);
    ctx.fillStyle = "#e9fbff";
    ctx.font = "700 22px Bahnschrift, Segoe UI, sans-serif";
    ctx.fillText(`FINAL SCORE ${model.score}`, model.arena.width / 2, model.arena.height / 2 + 24);
    ctx.fillStyle = "#9bd6dd";
    ctx.font = "500 16px Bahnschrift, Segoe UI, sans-serif";
    ctx.fillText("Press Enter, Space, or tap to redeploy", model.arena.width / 2, model.arena.height / 2 + 68);
    ctx.restore();
  }

  private drawTouchControls(ctx: CanvasRenderingContext2D, touch: TouchHudState, width: number, height: number) {
    if (width > 820 && !touch.joystick.active && !touch.boostPressed) return;

    const baseY = height - 94;
    const joyX = 92;
    const boostX = width - 92;
    ctx.save();
    ctx.globalAlpha = 0.52;
    ctx.strokeStyle = "#6eeeff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(touch.joystick.active ? touch.joystick.origin.x : joyX, touch.joystick.active ? touch.joystick.origin.y : baseY, 56, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(110, 238, 255, 0.2)";
    ctx.beginPath();
    ctx.arc(touch.joystick.active ? touch.joystick.current.x : joyX, touch.joystick.active ? touch.joystick.current.y : baseY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = touch.boostPressed ? "#ffb463" : "#ff7a2d";
    ctx.beginPath();
    ctx.arc(boostX, baseY, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = touch.boostPressed ? "rgba(255, 180, 99, 0.32)" : "rgba(255, 122, 45, 0.16)";
    ctx.fill();
    ctx.fillStyle = "#ffe1bd";
    ctx.font = "700 13px Bahnschrift, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BOOST", boostX, baseY + 5);
    ctx.restore();
  }

  private drawBossSummonButton(ctx: CanvasRenderingContext2D, model: GameModel) {
    if (model.phase !== "playing" || model.boss || model.bossSummoned) return;

    const w = 140;
    const h = 44;
    const x = model.arena.width - w - 16;
    const y = 16;

    ctx.save();
    ctx.fillStyle = "rgba(5, 10, 13, 0.64)";
    ctx.strokeStyle = "rgba(255, 122, 45, 0.6)";
    ctx.lineWidth = 2;
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ff7a2d";
    ctx.font = "700 14px Bahnschrift, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SUMMON BOSS", x + w / 2, y + h / 2);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.restore();
  }

  private drawAsset(
    ctx: CanvasRenderingContext2D,
    assets: LoadedAssets,
    key: AssetKey,
    x: number,
    y: number,
    size: number,
    rotation: number,
    fallback: () => void,
  ) {
    const image = assets.images[key];
    if (!image) {
      fallback();
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  private fallbackPlayer(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = "#42f4ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#b8cdd2";
    ctx.strokeStyle = "#48eaff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(28, 18);
    ctx.lineTo(0, 9);
    ctx.lineTo(-28, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#12242a";
    ctx.fillRect(-10, -8, 20, 15);
    ctx.restore();
  }

  private fallbackEnemy(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, type: string, phase: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(phase);
    ctx.fillStyle = type === "drifter" ? "#6d8d95" : type === "orbiter" ? "#a96b3e" : "#9a5b52";
    ctx.strokeStyle = "#ff8b43";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6;
      const r = i % 2 === 0 ? radius : radius * 0.58;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private fallbackMine(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, phase: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(phase);
    ctx.fillStyle = "#211915";
    ctx.strokeStyle = "#ff7a2d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius * 0.65, Math.sin(angle) * radius * 0.65);
      ctx.lineTo(Math.cos(angle) * radius * 1.2, Math.sin(angle) * radius * 1.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private fallbackCore(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, phase: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(phase);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#55f3ff";
    ctx.strokeStyle = "#eaffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.lineTo(radius * 0.86, 0);
    ctx.lineTo(0, radius);
    ctx.lineTo(-radius * 0.86, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private fallbackBoss(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, phase: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(phase) * 0.08);
    ctx.fillStyle = "#283038";
    ctx.strokeStyle = "#ff8a38";
    ctx.lineWidth = 4;
    this.roundRect(ctx, -radius, -radius * 0.62, radius * 2, radius * 1.24, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#57edff";
    ctx.fillRect(-radius * 0.42, -8, radius * 0.84, 16);
    ctx.restore();
  }

  private fallbackBadge(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#57edff";
    ctx.fillStyle = "rgba(13, 28, 34, 0.92)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -72);
    ctx.lineTo(78, -20);
    ctx.lineTo(48, 66);
    ctx.lineTo(-48, 66);
    ctx.lineTo(-78, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff8a38";
    ctx.fillRect(-38, -8, 76, 16);
    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    const r = clamp(radius, 0, Math.min(width, height) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  private fitText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    baseSize: number,
    minSize: number,
    weight: string,
    color: string,
  ) {
    let size = baseSize;
    ctx.textAlign = "center";
    do {
      ctx.font = `${weight} ${size}px Bahnschrift, Segoe UI, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth || size <= minSize) {
        break;
      }
      size -= 1;
    } while (size >= minSize);

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}
