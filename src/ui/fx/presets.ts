// Presets of the effects layer: what a burst spawns and how a particle is
// painted. Counts and lifetimes scale with `stage.scale` (fxScale()): the
// "short" setting gives about half the particles for about half the time.
// Painters get the canvas with a fresh save(); no shadows or blurs (slow on
// phones), glow only through "lighter" compositing.

import type { Particle, Stage } from "./layer";

export type FxPreset = "sparks" | "petals" | "gold" | "rays";
export const FX_PRESETS: FxPreset[] = ["sparks", "petals", "gold", "rays"];

type Spawner = (stage: Stage) => Particle[];
type Painter = (ctx: CanvasRenderingContext2D, p: Particle, t: number, x: number, y: number, w: number, h: number) => void;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const TAU = Math.PI * 2;

function particle(kind: FxPreset, stage: Stage, over: Partial<Particle>): Particle {
  return {
    kind,
    shape: 0,
    x: stage.x,
    y: stage.y,
    vx: 0,
    vy: 0,
    g: 0,
    drag: 1,
    sway: 0,
    swayHz: 0,
    rot: 0,
    vrot: 0,
    size: 2,
    color: "#fff",
    delay: 0,
    life: 1000,
    seed: Math.random(),
    ...over,
  };
}

/** Embers flying out of a point and falling: below mangan. */
const SPARK_COLORS = ["#ffd36b", "#ffb347", "#ff8a4c", "#fff1b8", "#ffc46b"];
const sparks: Spawner = (s) => {
  const n = Math.round(48 * s.scale);
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU);
    const v = rnd(120, 420);
    out.push(
      particle("sparks", s, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 90,
        g: 520,
        drag: 0.3,
        size: rnd(1.6, 3.4),
        color: pick(SPARK_COLORS),
        delay: rnd(0, 60),
        life: rnd(600, 1000) * s.scale,
      }),
    );
  }
  return out;
};

/** Cherry petals drifting down over the whole table: mangan and haneman. */
const PETAL_COLORS = ["#ffb7c5", "#ff9fb6", "#ffd1dc", "#f78fa7", "#ffc7d6"];
const petals: Spawner = (s) => {
  const n = Math.round(28 * s.scale);
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const life = rnd(2300, 3000) * s.scale;
    const y0 = -rnd(10, 40);
    out.push(
      particle("petals", s, {
        shape: i % 2,
        x: rnd(-10, s.w + 10),
        y: y0,
        vx: rnd(-25, 25),
        // Reaches the bottom edge about when it fades.
        vy: ((s.h + 40 - y0) / life) * 1000,
        sway: rnd(14, 34),
        swayHz: rnd(1.2, 2.4),
        rot: rnd(0, TAU),
        vrot: rnd(-3, 3),
        size: rnd(6, 11),
        color: pick(PETAL_COLORS),
        delay: rnd(0, 1100 * s.scale),
        life,
      }),
    );
  }
  return out;
};

/** Gold confetti thrown up from a point, spinning and glinting: baiman and sanbaiman. */
const GOLD_COLORS = ["#f8d56b", "#e0b240", "#fff3c4", "#d9a52e", "#ffe28a"];
const gold: Spawner = (s) => {
  const n = Math.round(70 * s.scale);
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd(-Math.PI * 0.83, -Math.PI * 0.17);
    const v = rnd(220, 560);
    out.push(
      particle("gold", s, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        g: 760,
        drag: 0.45,
        sway: rnd(0, 6),
        swayHz: rnd(4, 9),
        rot: rnd(0, TAU),
        vrot: rnd(-6, 6),
        size: rnd(4, 7.5),
        color: pick(GOLD_COLORS),
        delay: rnd(0, 120),
        life: rnd(1700, 2300) * s.scale,
      }),
    );
  }
  return out;
};

/** Light rays turning slowly around a point, with a soft glow at its heart. */
const rays: Spawner = (s) => {
  const n = Math.max(6, Math.round(12 * s.scale));
  const life = 1500 * s.scale;
  const out: Particle[] = [particle("rays", s, { shape: 1, size: Math.max(s.w, s.h) * 0.22, color: "#fff4c2", life })];
  for (let i = 0; i < n; i++) {
    out.push(
      particle("rays", s, {
        rot: (i / n) * TAU + rnd(-0.15, 0.15),
        vrot: rnd(0.08, 0.2) * (i % 2 ? 1 : -1),
        // Angular width of the ray, radians.
        size: rnd(0.03, 0.09),
        color: i % 3 ? "#fff4c2" : "#ffd98a",
        life,
      }),
    );
  }
  return out;
};

export const SPAWNERS: Record<FxPreset, Spawner> = { sparks, petals, gold, rays };

/** 1 until `from`, then down to 0 at 1. */
const fadeOut = (t: number, from: number) => (t < from ? 1 : Math.max(0, 1 - (t - from) / (1 - from)));

const paintSparks: Painter = (ctx, p, t, x, y) => {
  const a = fadeOut(t, 0.35);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;
  ctx.strokeStyle = p.color;
  ctx.lineWidth = p.size;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - p.vx * 0.025, y - p.vy * 0.025);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.globalAlpha = a * 0.8;
  ctx.fillStyle = "#fff8e1";
  ctx.beginPath();
  ctx.arc(x, y, p.size * 0.45, 0, TAU);
  ctx.fill();
};

const paintPetals: Painter = (ctx, p, t, x, y) => {
  ctx.globalAlpha = 0.92 * Math.min(1, t * 8) * fadeOut(t, 0.78);
  ctx.translate(x, y);
  ctx.rotate(p.rot);
  // A petal: an ellipse seen edge-on as it tumbles, with a lighter heart.
  const flip = 0.35 + 0.65 * Math.abs(Math.cos(p.seed * 6.283 + t * (p.shape ? 9 : 7)));
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.size, p.size * 0.62 * flip, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.ellipse(-p.size * 0.25, 0, p.size * 0.45, p.size * 0.3 * flip, 0, 0, TAU);
  ctx.fill();
};

const paintGold: Painter = (ctx, p, t, x, y) => {
  ctx.globalAlpha = fadeOut(t, 0.72);
  ctx.translate(x, y);
  ctx.rotate(p.rot);
  // The piece flips as it spins; its back is darker and its edge catches light.
  const flip = Math.cos(p.seed * 6.283 + t * 14 * (0.6 + p.seed));
  const wdt = p.size * Math.max(0.12, Math.abs(flip));
  ctx.fillStyle = flip > 0 ? p.color : "#b8862a";
  ctx.fillRect(-wdt / 2, -p.size * 0.3, wdt, p.size * 0.6);
  if (Math.abs(flip) < 0.3) {
    ctx.fillStyle = "#fffbe6";
    ctx.fillRect(-wdt / 2, -p.size * 0.3, wdt, p.size * 0.6);
  }
};

const paintRays: Painter = (ctx, p, t, x, y, w, h) => {
  const env = Math.sin(Math.PI * t);
  ctx.globalCompositeOperation = "lighter";
  if (p.shape === 1) {
    // The glow at the heart of the rays.
    const r = p.size * (0.8 + 0.2 * env);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255, 244, 194, 0.4)");
    grad.addColorStop(0.5, "rgba(255, 236, 170, 0.12)");
    grad.addColorStop(1, "rgba(255, 236, 170, 0)");
    ctx.globalAlpha = env;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    return;
  }
  const len = Math.max(w, h) * 1.25;
  const half = p.size / 2;
  const grad = ctx.createLinearGradient(x, y, x + Math.cos(p.rot) * len, y + Math.sin(p.rot) * len);
  grad.addColorStop(0, p.color);
  grad.addColorStop(1, "rgba(255, 244, 194, 0)");
  ctx.globalAlpha = 0.16 * env;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(p.rot - half) * len, y + Math.sin(p.rot - half) * len);
  ctx.lineTo(x + Math.cos(p.rot + half) * len, y + Math.sin(p.rot + half) * len);
  ctx.closePath();
  ctx.fill();
};

export const PAINTERS: Record<FxPreset, Painter> = {
  sparks: paintSparks,
  petals: paintPetals,
  gold: paintGold,
  rays: paintRays,
};
