import { createRng, type Rng } from "./random";
import type { Arena, EnemyType, SpawnEvent } from "./types";
import type { Vec2 } from "./vector";
import { fromAngle, normalize, sub } from "./vector";

export type SpawnDirector = {
  plan: (elapsed: number, arena: Arena, playerPosition: Vec2, isBossPhase?: boolean) => SpawnEvent[];
};

const enemyTypes: readonly EnemyType[] = ["chaser", "drifter", "orbiter"];

const edgePosition = (rng: Rng, arena: Arena): Vec2 => {
  const edge = rng.integer(0, 3);
  if (edge === 0) return { x: rng.range(30, arena.width - 30), y: -40 };
  if (edge === 1) return { x: arena.width + 40, y: rng.range(30, arena.height - 30) };
  if (edge === 2) return { x: rng.range(30, arena.width - 30), y: arena.height + 40 };
  return { x: -40, y: rng.range(30, arena.height - 30) };
};

const addEnemy = (events: SpawnEvent[], rng: Rng, elapsed: number, arena: Arena, playerPosition: Vec2) => {
  const earlyTypes: readonly EnemyType[] = ["chaser", "drifter"];
  const type: EnemyType = elapsed < 34 ? "chaser" : elapsed < 72 ? rng.pick(earlyTypes) : rng.pick(enemyTypes);
  const position = edgePosition(rng, arena);
  const drift = fromAngle(rng.range(0, Math.PI * 2), rng.range(30, 90));
  const velocity =
    type === "chaser" ? { x: 0, y: 0 } : type === "drifter" ? drift : normalize(sub(playerPosition, position));
  events.push({ kind: "enemy", type, position, velocity });
};

export const createSpawnDirector = (seed = Date.now()): SpawnDirector => {
  const rng = createRng(seed);
  let bossPlanned = false;

  return {
    plan: (elapsed, arena, playerPosition, isBossPhase = false) => {
      const events: SpawnEvent[] = [];

      if (elapsed >= 140 && !bossPlanned) {
        bossPlanned = true;
        events.push({ kind: "boss" });
      }

      if (isBossPhase) {
        return events;
      }

      if (elapsed < 140) {
        events.push({
          kind: "core",
          position: {
            x: rng.range(70, arena.width - 70),
            y: rng.range(80, arena.height - 80),
          },
        });
      }

      const enemyCount = elapsed < 24 ? 1 : elapsed < 62 ? 2 : elapsed < 108 ? 3 : 4;
      for (let index = 0; index < enemyCount; index += 1) {
        addEnemy(events, rng, elapsed, arena, playerPosition);
      }

      if (elapsed > 28 && rng.next() < Math.min(0.28 + elapsed / 340, 0.68)) {
        events.push({
          kind: "mine",
          position: {
            x: rng.range(80, arena.width - 80),
            y: rng.range(95, arena.height - 95),
          },
        });
      }

      return events;
    },
  };
};
