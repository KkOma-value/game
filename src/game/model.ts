import type { Arena, Boss, GameModel, InputFrame, SpawnEvent } from "./types";
import { add, clamp, clampVec, distance, fromAngle, normalize, scale, sub, vec } from "./vector";

const runDuration = 180;
const bossStart = 140;

export const createInitialModel = (arena: Arena): GameModel => ({
  arena,
  phase: "title",
  elapsed: 0,
  score: 0,
  bossCharge: 0,
  player: {
    position: { x: arena.width / 2, y: arena.height * 0.62 },
    velocity: vec(),
    radius: 24,
    health: 3,
    invulnerable: 0,
    boostCooldown: 0,
    boostTrail: 0,
    fireCooldown: 0,
    lastFireDirection: { x: 0, y: -1 },
  },
  enemies: [],
  cores: [],
  mines: [],
  projectiles: [],
  playerProjectiles: [],
  particles: [],
  boss: null,
  shake: 0,
  banner: "RIFT SALVAGE",
  nextId: 1,
  bossSummoned: false,
});

export const startRun = (model: GameModel): void => {
  const clean = createInitialModel(model.arena);
  Object.assign(model, clean, { phase: "playing", banner: "CORE RECOVERY ACTIVE", bossSummoned: false });
};

export const resizeModel = (model: GameModel, arena: Arena): void => {
  model.arena = arena;
  model.player.position = clampVec(model.player.position, { x: 35, y: 45 }, { x: arena.width - 35, y: arena.height - 35 });
};

const id = (model: GameModel, prefix: string) => `${prefix}-${model.nextId++}`;

const MAX_PARTICLES = 120;

const makeParticles = (model: GameModel, position: { x: number; y: number }, color: string, count: number) => {
  const availableSlots = Math.max(0, MAX_PARTICLES - model.particles.length);
  const actualCount = Math.min(count, availableSlots);
  for (let index = 0; index < actualCount; index += 1) {
    const velocity = fromAngle((Math.PI * 2 * index) / count + model.elapsed, 80 + index * 9);
    model.particles.push({
      id: id(model, "p"),
      position: { ...position },
      velocity,
      radius: 2 + (index % 4),
      color,
      ttl: 0.45 + index * 0.018,
      life: 0,
    });
  }
};

const spawnBoss = (model: GameModel): Boss => ({
  id: id(model, "boss"),
  position: { x: model.arena.width / 2, y: Math.max(110, model.arena.height * 0.2) },
  velocity: vec(),
  radius: 72,
  timer: 0,
  hp: 100,
});

const applySpawnEvent = (model: GameModel, event: SpawnEvent) => {
  if (event.kind === "core") {
    model.cores.push({ id: id(model, "core"), position: event.position, radius: 18, value: 25, pulse: 0 });
  }

  if (event.kind === "mine") {
    model.mines.push({ id: id(model, "mine"), position: event.position, radius: 25, armed: 0.65, pulse: 0 });
  }

  if (event.kind === "enemy" && model.enemies.length < 20) {
    const radius = event.type === "orbiter" ? 26 : event.type === "drifter" ? 30 : 24;
    model.enemies.push({
      id: id(model, "enemy"),
      type: event.type,
      position: event.position,
      velocity: event.velocity,
      radius,
      hp: event.type === "orbiter" ? 2 : 1,
      phase: model.elapsed,
    });
  }

  if (event.kind === "boss" && !model.boss) {
    model.phase = "boss";
    model.boss = spawnBoss(model);
    model.banner = "RIFT ANCHOR DETECTED";
    model.shake = 0.8;
  }
};

const damagePlayer = (model: GameModel, amount = 1) => {
  if (model.player.invulnerable > 0 || model.phase === "win" || model.phase === "gameover") {
    return;
  }

  model.player.health -= amount;
  model.player.invulnerable = 1.15;
  model.shake = Math.max(model.shake, 0.55);
  makeParticles(model, model.player.position, "#ff7a2d", 10);

  if (model.player.health <= 0) {
    model.phase = "gameover";
    model.banner = "DRONE SIGNAL LOST";
  }
};

const updatePlayer = (model: GameModel, dt: number, input: InputFrame) => {
  const movement = normalize(input.move);
  const canBoost = input.boost && model.player.boostCooldown <= 0 && (movement.x !== 0 || movement.y !== 0);
  const speed = canBoost ? 620 : 310;
  model.player.velocity = scale(movement, speed);
  model.player.position = add(model.player.position, scale(model.player.velocity, dt));
  model.player.position = clampVec(model.player.position, { x: 28, y: 42 }, { x: model.arena.width - 28, y: model.arena.height - 28 });

  if (canBoost) {
    model.player.boostCooldown = 1.8;
    model.player.boostTrail = 0.28;
    model.player.invulnerable = Math.max(model.player.invulnerable, 0.2);
    makeParticles(model, model.player.position, "#36f0ff", 10);
  }

  model.player.invulnerable = Math.max(0, model.player.invulnerable - dt);
  model.player.boostCooldown = Math.max(0, model.player.boostCooldown - dt);
  model.player.boostTrail = Math.max(0, model.player.boostTrail - dt);
};

const updateEnemies = (model: GameModel, dt: number) => {
  for (const enemy of model.enemies) {
    enemy.phase += dt;
    if (enemy.type === "chaser") {
      const direction = normalize(sub(model.player.position, enemy.position));
      enemy.velocity = scale(direction, 96 + clamp(model.elapsed, 0, 140) * 0.72);
    } else if (enemy.type === "drifter") {
      enemy.velocity.x += Math.sin(enemy.phase * 2.7) * 18 * dt;
      enemy.velocity.y += Math.cos(enemy.phase * 2.2) * 18 * dt;
    } else {
      const direction = normalize(sub(model.player.position, enemy.position));
      const tangent = { x: -direction.y, y: direction.x };
      enemy.velocity = add(scale(direction, 62), scale(tangent, 118 * Math.sin(enemy.phase * 1.8)));

      if (model.projectiles.length < 60 && Math.floor(enemy.phase * 2) !== Math.floor((enemy.phase - dt) * 2)) {
        model.projectiles.push({
          id: id(model, "shot"),
          position: { ...enemy.position },
          velocity: scale(direction, 210),
          radius: 8,
          ttl: 3.8,
        });
      }
    }

    enemy.position = add(enemy.position, scale(enemy.velocity, dt));
  }

  model.enemies = model.enemies.filter(
    (enemy) =>
      enemy.position.x > -130 &&
      enemy.position.x < model.arena.width + 130 &&
      enemy.position.y > -130 &&
      enemy.position.y < model.arena.height + 130,
  );
};

const updateBoss = (model: GameModel, dt: number) => {
  if (!model.boss) return;

  const boss = model.boss;
  boss.timer += dt;
  boss.position.x = model.arena.width / 2 + Math.sin(boss.timer * 0.86) * Math.min(260, model.arena.width * 0.26);
  boss.position.y = Math.max(92, model.arena.height * 0.2 + Math.cos(boss.timer * 0.55) * 34);

  if (Math.floor(boss.timer * 0.9) !== Math.floor((boss.timer - dt) * 0.9)) {
    const spokes = 5;
    for (let index = 0; index < spokes; index += 1) {
      const angle = (Math.PI * 2 * index) / spokes + boss.timer * 0.44;
      model.projectiles.push({
        id: id(model, "boss-shot"),
        position: { ...boss.position },
        velocity: fromAngle(angle, 190),
        radius: 9,
        ttl: 3.5,
      });
    }
  }

  if (model.enemies.length < 15 && Math.floor(boss.timer / 4.5) !== Math.floor((boss.timer - dt) / 4.5)) {
    model.enemies.push({
      id: id(model, "guard"),
      type: "chaser",
      position: { x: boss.position.x + Math.sin(boss.timer) * 92, y: boss.position.y + 90 },
      velocity: vec(),
      radius: 23,
      hp: 1,
      phase: 0,
    });
  }
};

const updatePickupsAndHazards = (model: GameModel, dt: number) => {
  for (const core of model.cores) {
    core.pulse += dt;
    const toPlayer = sub(model.player.position, core.position);
    if (distance(model.player.position, core.position) < 112) {
      core.position = add(core.position, scale(normalize(toPlayer), 185 * dt));
    }
  }

  const collected = model.cores.filter((core) => distance(model.player.position, core.position) < model.player.radius + core.radius);
  if (collected.length > 0) {
    for (const core of collected) {
      model.score += core.value;
      model.bossCharge = Math.min(100, model.bossCharge + core.value);
      makeParticles(model, core.position, "#64f7ff", 8);
    }
    model.cores = model.cores.filter((core) => !collected.includes(core));
  }

  for (const mine of model.mines) {
    mine.armed = Math.max(0, mine.armed - dt);
    mine.pulse += dt;
    if (mine.armed <= 0 && distance(model.player.position, mine.position) < model.player.radius + mine.radius + 8) {
      damagePlayer(model);
      mine.radius = 92;
      mine.armed = -1;
      makeParticles(model, mine.position, "#ff4f2d", 14);
    }
  }
  model.mines = model.mines.filter((mine) => mine.armed >= 0);
};

const updateProjectilesAndParticles = (model: GameModel, dt: number) => {
  for (const projectile of model.projectiles) {
    projectile.position = add(projectile.position, scale(projectile.velocity, dt));
    projectile.ttl -= dt;
    if (distance(projectile.position, model.player.position) < projectile.radius + model.player.radius) {
      projectile.ttl = 0;
      damagePlayer(model);
    }
  }

  model.projectiles = model.projectiles.filter((projectile) => projectile.ttl > 0);

  for (const particle of model.particles) {
    particle.life += dt;
    particle.position = add(particle.position, scale(particle.velocity, dt));
    particle.velocity = scale(particle.velocity, 1 - Math.min(0.12, dt * 3.5));
  }

  model.particles = model.particles.filter((particle) => particle.life < particle.ttl);
};

const PLAYER_PROJECTILE_SPEED = 480;
const PLAYER_FIRE_COOLDOWN = 0.2;
const PLAYER_PROJECTILE_TTL = 1.2;
const PLAYER_PROJECTILE_RADIUS = 6;

const firePlayerWeapon = (model: GameModel, input: InputFrame, dt: number) => {
  model.player.fireCooldown = Math.max(0, model.player.fireCooldown - dt);

  const moveLen = Math.hypot(input.move.x, input.move.y);
  let dir = model.player.lastFireDirection;
  if (moveLen > 0.1) {
    dir = normalize(input.move);
    model.player.lastFireDirection = dir;
  }

  if (input.attack && model.player.fireCooldown <= 0 && model.playerProjectiles.length < 20) {
    model.player.fireCooldown = PLAYER_FIRE_COOLDOWN;
    model.playerProjectiles.push({
      id: id(model, "pshot"),
      position: { ...model.player.position },
      velocity: scale(dir, PLAYER_PROJECTILE_SPEED),
      radius: PLAYER_PROJECTILE_RADIUS,
      ttl: PLAYER_PROJECTILE_TTL,
    });
  }
};

const updatePlayerProjectiles = (model: GameModel, dt: number) => {
  for (const proj of model.playerProjectiles) {
    proj.position = add(proj.position, scale(proj.velocity, dt));
    proj.ttl -= dt;

    if (proj.ttl <= 0) continue;

    for (const enemy of model.enemies) {
      if (distance(proj.position, enemy.position) < proj.radius + enemy.radius) {
        proj.ttl = 0;
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
          makeParticles(model, enemy.position, "#ff8a38", 8);
          model.score += enemy.type === "orbiter" ? 15 : enemy.type === "drifter" ? 10 : 8;
        }
        break;
      }
    }

    if (model.boss && proj.ttl > 0) {
      if (distance(proj.position, model.boss.position) < proj.radius + model.boss.radius) {
        proj.ttl = 0;
        model.boss.hp -= 1;
        makeParticles(model, proj.position, "#ffb463", 4);
        model.shake = Math.max(model.shake, 0.12);
        if (model.boss.hp <= 0) {
          model.phase = "win";
          model.banner = "RIFT ANCHOR DESTROYED";
          model.score += Math.round(model.bossCharge * 10) + 500;
          makeParticles(model, model.boss.position, "#8fffe9", 24);
          model.boss = null;
        }
      }
    }
  }

  model.enemies = model.enemies.filter((e) => e.hp > 0);
  model.playerProjectiles = model.playerProjectiles.filter((p) => p.ttl > 0);
};

const resolveContacts = (model: GameModel) => {
  for (const enemy of model.enemies) {
    if (distance(enemy.position, model.player.position) < enemy.radius + model.player.radius) {
      damagePlayer(model);
      const shove = normalize(sub(enemy.position, model.player.position));
      enemy.position = add(enemy.position, scale(shove, 46));
    }
  }

  if (model.boss && distance(model.boss.position, model.player.position) < model.boss.radius + model.player.radius) {
    damagePlayer(model, 2);
  }
};

export const summonBoss = (model: GameModel): void => {
  if (model.phase !== "playing" || model.boss) return;
  applySpawnEvent(model, { kind: "boss" });
  model.bossSummoned = true;
};

export const stepModel = (model: GameModel, dt: number, input: InputFrame, spawnEvents: SpawnEvent[]): void => {
  const cappedDt = Math.min(dt, 0.05);

  for (const event of spawnEvents) {
    applySpawnEvent(model, event);
  }

  if (model.elapsed >= bossStart && model.phase !== "boss" && model.phase !== "win" && model.phase !== "gameover") {
    applySpawnEvent(model, { kind: "boss" });
  }

  if (model.phase !== "win" && model.phase !== "gameover") {
    model.elapsed += cappedDt;
    updatePlayer(model, cappedDt, input);
    firePlayerWeapon(model, input, cappedDt);
    updateEnemies(model, cappedDt);
    updateBoss(model, cappedDt);
    updatePickupsAndHazards(model, cappedDt);
    updateProjectilesAndParticles(model, cappedDt);
    updatePlayerProjectiles(model, cappedDt);
    resolveContacts(model);
  }

  model.shake = Math.max(0, model.shake - cappedDt * 1.8);

  if (model.phase === "boss" && model.elapsed >= runDuration && model.player.health > 0) {
    model.phase = "win";
    model.banner = "RIFT STABILIZED";
    model.score += Math.round(model.bossCharge * 10);
    makeParticles(model, model.player.position, "#8fffe9", 34);
  }
};
