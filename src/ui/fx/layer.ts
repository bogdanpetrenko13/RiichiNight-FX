// The effects layer: one <canvas> over the table (FxCanvas.tsx), Canvas 2D,
// a flat pool of particles. requestAnimationFrame runs only while something
// is alive: the last particle gone, the canvas is wiped and the loop stops.
// Everything a preset spawns obeys fxScale() (Settings -> Table animations,
// "reduce motion"): at 0 nothing is spawned and nothing is drawn.

import { fxScale } from "../tableFx";
import { PAINTERS, SPAWNERS, type FxPreset } from "./presets";

export interface Particle {
  kind: FxPreset;
  /** A variant inside the preset (a ray / its glow, a petal's shape). */
  shape: number;
  /** Position in CSS px of the canvas. */
  x: number;
  y: number;
  /** Velocity, px per second. */
  vx: number;
  vy: number;
  /** Gravity (px/s²) and the share of the velocity kept per second. */
  g: number;
  drag: number;
  /** Side sway: amplitude (px) and angular speed (rad/s). */
  sway: number;
  swayHz: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
  /** ms after the burst before it appears, then how long it lives. */
  delay: number;
  life: number;
  /** 0..1, a stable per-particle random number for the painters. */
  seed: number;
}

export interface PlayOptions {
  /** Where it comes from: an element on the page or canvas coordinates; default the middle. */
  at?: Element | { x: number; y: number } | null;
}

/** The frame the spawners work in. */
export interface Stage {
  w: number;
  h: number;
  x: number;
  y: number;
  /** fxScale() at the moment of the burst (0 < scale <= 1). */
  scale: number;
}

const MAX_PARTICLES = 420;
/** A frame after a long pause (background tab) advances at most this far. */
const MAX_STEP = 0.05;

export class FxLayer {
  private ctx: CanvasRenderingContext2D | null;
  private items: Particle[] = [];
  private born: number[] = [];
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private ro: ResizeObserver | null = null;
  /** Frames drawn since mount (tests watch it stop). */
  frames = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
    this.fit();
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.fit());
      this.ro.observe(canvas);
    }
  }

  destroy() {
    this.ro?.disconnect();
    this.stop();
    this.items = [];
    this.born = [];
  }

  /** Something is still flying (the loop is running). */
  active(): boolean {
    return this.raf !== 0;
  }

  count(): number {
    return this.items.length;
  }

  /** Spawns a preset; returns how many particles it added (0 when effects are off). */
  play(preset: FxPreset, opts: PlayOptions = {}): number {
    const scale = fxScale();
    const spawn = SPAWNERS[preset];
    if (!scale || !spawn || !this.ctx) return 0;
    this.fit();
    const origin = this.origin(opts.at);
    const fresh = spawn({ w: this.w, h: this.h, x: origin.x, y: origin.y, scale });
    const room = Math.max(0, MAX_PARTICLES - this.items.length);
    const added = fresh.slice(0, room);
    const now = performance.now();
    for (const p of added) {
      this.items.push(p);
      this.born.push(now);
    }
    if (added.length && !this.raf) {
      this.last = now;
      this.raf = requestAnimationFrame(this.frame);
    }
    return added.length;
  }

  /** Drops everything at once and wipes the canvas. */
  clear() {
    this.items = [];
    this.born = [];
    this.stop();
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ctx?.clearRect(0, 0, this.w, this.h);
  }

  private origin(at: PlayOptions["at"]): { x: number; y: number } {
    if (at && "getBoundingClientRect" in at) {
      const r = at.getBoundingClientRect();
      const c = this.canvas.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
    } else if (at) {
      return { x: at.x, y: at.y };
    }
    return { x: this.w / 2, y: this.h / 2 };
  }

  /** The bitmap follows the element's CSS size and the pixel ratio (capped: phones at 3x gain nothing). */
  private fit() {
    const { canvas, ctx } = this;
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (w === this.w && h === this.h && canvas.width === bw && canvas.height === bh) return;
    this.w = w;
    this.h = h;
    canvas.width = bw;
    canvas.height = bh;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private frame = (now: number) => {
    const ctx = this.ctx;
    if (!ctx) return;
    const dt = Math.min(MAX_STEP, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    ctx.clearRect(0, 0, this.w, this.h);
    this.frames++;
    const items = this.items;
    const born = this.born;
    let keep = 0;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      const age = now - born[i] - p.delay;
      if (age >= p.life) continue;
      items[keep] = p;
      born[keep] = born[i];
      keep++;
      if (age < 0) continue;
      // Physics: gravity, drag, sway, spin.
      p.vy += p.g * dt;
      if (p.drag !== 1) {
        const k = Math.pow(p.drag, dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      const t = age / p.life;
      const sx = p.sway ? Math.sin((age / 1000) * p.swayHz + p.seed * 6.283) * p.sway : 0;
      ctx.save();
      PAINTERS[p.kind](ctx, p, t, p.x + sx, p.y, this.w, this.h);
      ctx.restore();
    }
    items.length = keep;
    born.length = keep;
    this.raf = keep ? requestAnimationFrame(this.frame) : 0;
    if (!keep) ctx.clearRect(0, 0, this.w, this.h);
  };
}
