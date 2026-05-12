export type Vec2 = {
  x: number;
  y: number;
};

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (value: Vec2, amount: number): Vec2 => ({ x: value.x * amount, y: value.y * amount });

export const length = (value: Vec2): number => Math.hypot(value.x, value.y);

export const distance = (a: Vec2, b: Vec2): number => length(sub(a, b));

export const normalize = (value: Vec2): Vec2 => {
  const magnitude = length(value);
  if (magnitude < 0.0001) {
    return vec();
  }

  return scale(value, 1 / magnitude);
};

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const clampVec = (value: Vec2, min: Vec2, max: Vec2): Vec2 => ({
  x: clamp(value.x, min.x, max.x),
  y: clamp(value.y, min.y, max.y),
});

export const fromAngle = (angle: number, magnitude = 1): Vec2 => ({
  x: Math.cos(angle) * magnitude,
  y: Math.sin(angle) * magnitude,
});
