import { describe, expect, it } from "vitest";
import { assetManifest, requiredAssetKeys } from "./game/assets";
import { createInitialModel, stepModel } from "./game/model";
import { createSpawnDirector } from "./game/spawner";
import { distance, normalize } from "./game/vector";

describe("asset manifest", () => {
  it("declares all required imagegen asset paths", () => {
    expect(Object.keys(assetManifest).sort()).toEqual([...requiredAssetKeys].sort());
    expect(assetManifest.player).toBe("/assets/player-drone.png");
    expect(assetManifest.enemyOrbiter).toBe("/assets/enemy-orbiter.png");
    expect(assetManifest.titleBadge).toBe("/assets/title-badge.png");
  });
});

describe("vector utilities", () => {
  it("normalizes diagonal input without increasing speed", () => {
    const result = normalize({ x: 1, y: 1 });

    expect(distance({ x: 0, y: 0 }, result)).toBeCloseTo(1);
  });
});

describe("spawn director", () => {
  it("escalates enemies over the run and starts boss near 140 seconds", () => {
    const director = createSpawnDirector(123);

    const early = director.plan(8, { width: 1280, height: 720 }, { x: 640, y: 360 });
    const mid = director.plan(86, { width: 1280, height: 720 }, { x: 640, y: 360 });
    const boss = director.plan(141, { width: 1280, height: 720 }, { x: 640, y: 360 });

    expect(early.some((event) => event.kind === "core")).toBe(true);
    expect(mid.filter((event) => event.kind === "enemy").length).toBeGreaterThan(
      early.filter((event) => event.kind === "enemy").length,
    );
    expect(boss.some((event) => event.kind === "boss")).toBe(true);
  });
});

describe("game model", () => {
  it("collects nearby energy cores and advances score and charge", () => {
    const model = createInitialModel({ width: 800, height: 600 });
    model.cores.push({ id: "c", position: { ...model.player.position }, radius: 18, value: 25, pulse: 0 });

    stepModel(model, 0.016, { move: { x: 0, y: 0 }, boost: false, attack: false }, []);

    expect(model.score).toBe(25);
    expect(model.bossCharge).toBe(25);
    expect(model.cores).toHaveLength(0);
  });

  it("damages the player on enemy contact and respects invulnerability", () => {
    const model = createInitialModel({ width: 800, height: 600 });
    model.enemies.push({
      id: "e",
      type: "chaser",
      position: { ...model.player.position },
      velocity: { x: 0, y: 0 },
      radius: 24,
      hp: 1,
      phase: 0,
    });

    stepModel(model, 0.016, { move: { x: 0, y: 0 }, boost: false, attack: false }, []);
    stepModel(model, 0.016, { move: { x: 0, y: 0 }, boost: false, attack: false }, []);

    expect(model.player.health).toBe(2);
  });

  it("enters boss wave once elapsed time reaches the boss window", () => {
    const model = createInitialModel({ width: 800, height: 600 });
    model.elapsed = 140;

    stepModel(model, 0.016, { move: { x: 0, y: 0 }, boost: false, attack: false }, []);

    expect(model.phase).toBe("boss");
    expect(model.boss).not.toBeNull();
  });

  it("resets to a clean title-ready model", () => {
    const model = createInitialModel({ width: 800, height: 600 });

    expect(model.phase).toBe("title");
    expect(model.player.health).toBe(3);
    expect(model.score).toBe(0);
    expect(model.enemies).toHaveLength(0);
  });
});
