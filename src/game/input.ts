import type { InputFrame } from "./types";
import { clamp, normalize, type Vec2 } from "./vector";

type PointerState = {
  id: number;
  origin: Vec2;
  current: Vec2;
};

export type TouchHudState = {
  joystick: { active: boolean; origin: Vec2; current: Vec2 };
  boostPressed: boolean;
};

export class InputController {
  private readonly keys = new Set<string>();
  private joystick: PointerState | null = null;
  private boostPointer: number | null = null;
  private boostHeld = false;
  private startRequested = false;
  private attackRequested = false;
  private bossSummonRequested = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
  }

  frame(): InputFrame {
    const move = this.keyboardMove();
    const touchMove = this.touchMove();
    const activeMove = touchMove.x !== 0 || touchMove.y !== 0 ? touchMove : move;
    const attack = this.keys.has("j") || this.attackRequested;
    this.attackRequested = false;

    return {
      move: activeMove,
      boost: this.boostHeld || this.keys.has("shift") || this.keys.has(" "),
      attack,
    };
  }

  consumeStartRequest(): boolean {
    const requested = this.startRequested;
    this.startRequested = false;
    return requested;
  }

  consumeBossSummonRequest(): boolean {
    const requested = this.bossSummonRequested;
    this.bossSummonRequested = false;
    return requested;
  }

  touchHud(): TouchHudState {
    return {
      joystick: {
        active: this.joystick !== null,
        origin: this.joystick?.origin ?? { x: 0, y: 0 },
        current: this.joystick?.current ?? { x: 0, y: 0 },
      },
      boostPressed: this.boostHeld,
    };
  }

  private keyboardMove(): Vec2 {
    const x =
      (this.keys.has("arrowright") || this.keys.has("d") ? 1 : 0) -
      (this.keys.has("arrowleft") || this.keys.has("a") ? 1 : 0);
    const y =
      (this.keys.has("arrowdown") || this.keys.has("s") ? 1 : 0) -
      (this.keys.has("arrowup") || this.keys.has("w") ? 1 : 0);
    return normalize({ x, y });
  }

  private touchMove(): Vec2 {
    if (!this.joystick) {
      return { x: 0, y: 0 };
    }

    const dx = this.joystick.current.x - this.joystick.origin.x;
    const dy = this.joystick.current.y - this.joystick.origin.y;
    const max = 76;
    return {
      x: clamp(dx / max, -1, 1),
      y: clamp(dy / max, -1, 1),
    };
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.keys.add(key);
    if (key === "enter" || key === " ") {
      this.startRequested = true;
      event.preventDefault();
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };

  private onPointerDown = (event: PointerEvent) => {
    this.canvas.setPointerCapture(event.pointerId);
    const point = this.pointFromEvent(event);
    const isLeftHalf = point.x < this.canvas.clientWidth * 0.52;

    this.startRequested = true;
    this.attackRequested = true;

    const bossBtnX = this.canvas.clientWidth - 156;
    const bossBtnY = 16;
    const bossBtnW = 140;
    const bossBtnH = 44;
    if (
      point.x >= bossBtnX && point.x <= bossBtnX + bossBtnW &&
      point.y >= bossBtnY && point.y <= bossBtnY + bossBtnH
    ) {
      this.bossSummonRequested = true;
      event.preventDefault();
      return;
    }

    if (isLeftHalf && !this.joystick) {
      this.joystick = { id: event.pointerId, origin: point, current: point };
    } else {
      this.boostPointer = event.pointerId;
      this.boostHeld = true;
    }

    event.preventDefault();
  };

  private onPointerMove = (event: PointerEvent) => {
    const point = this.pointFromEvent(event);
    if (this.joystick?.id === event.pointerId) {
      this.joystick.current = point;
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.joystick?.id === event.pointerId) {
      this.joystick = null;
    }

    if (this.boostPointer === event.pointerId) {
      this.boostPointer = null;
      this.boostHeld = false;
    }
  };

  private pointFromEvent(event: PointerEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }
}
