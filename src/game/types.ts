import type { Vec2 } from "./vector";

export type Arena = {
  width: number;
  height: number;
};

export type GamePhase = "title" | "playing" | "boss" | "win" | "gameover";

export type EnemyType = "chaser" | "drifter" | "orbiter";

export type Player = {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  health: number;
  invulnerable: number;
  boostCooldown: number;
  boostTrail: number;
  fireCooldown: number;
  lastFireDirection: Vec2;
};

export type Enemy = {
  id: string;
  type: EnemyType;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  hp: number;
  phase: number;
};

export type Core = {
  id: string;
  position: Vec2;
  radius: number;
  value: number;
  pulse: number;
};

export type Mine = {
  id: string;
  position: Vec2;
  radius: number;
  armed: number;
  pulse: number;
};

export type Projectile = {
  id: string;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  ttl: number;
};

export type PlayerProjectile = {
  id: string;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  ttl: number;
};

export type Boss = {
  id: string;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  timer: number;
  hp: number;
};

export type Particle = {
  id: string;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  color: string;
  ttl: number;
  life: number;
};

export type InputFrame = {
  move: Vec2;
  boost: boolean;
  attack: boolean;
};

export type SpawnEvent =
  | { kind: "enemy"; type: EnemyType; position: Vec2; velocity: Vec2 }
  | { kind: "core"; position: Vec2 }
  | { kind: "mine"; position: Vec2 }
  | { kind: "boss" };

export type GameModel = {
  arena: Arena;
  phase: GamePhase;
  elapsed: number;
  score: number;
  bossCharge: number;
  player: Player;
  enemies: Enemy[];
  cores: Core[];
  mines: Mine[];
  projectiles: Projectile[];
  playerProjectiles: PlayerProjectile[];
  particles: Particle[];
  boss: Boss | null;
  shake: number;
  banner: string;
  nextId: number;
  bossSummoned: boolean;
};
