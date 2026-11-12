// The table's effects layer: `fx.play("sparks", { at: element })` from
// anywhere once <FxCanvas /> is mounted (Table.tsx). Presets in presets.ts,
// the canvas and its loop in layer.ts. Nothing plays when fxScale() is 0.

import { FxLayer, type PlayOptions } from "./layer";
import { FX_PRESETS, type FxPreset } from "./presets";

let layer: FxLayer | null = null;

export const fx = {
  /** Spawns a preset over the table; returns how many particles it added. */
  play(preset: FxPreset, opts?: PlayOptions): number {
    return layer?.play(preset, opts) ?? 0;
  },
  /** Particles are flying (the frame loop is running). */
  active(): boolean {
    return layer?.active() ?? false;
  },
  count(): number {
    return layer?.count() ?? 0;
  },
  /** Frames drawn so far (tests watch the loop stop). */
  frames(): number {
    return layer?.frames ?? 0;
  },
  clear(): void {
    layer?.clear();
  },
};

/** Called by FxCanvas: one layer at a time; returns the unmount. */
export function mountFxLayer(canvas: HTMLCanvasElement): () => void {
  layer?.destroy();
  const mine = new FxLayer(canvas);
  layer = mine;
  return () => {
    mine.destroy();
    if (layer === mine) layer = null;
  };
}

/**
 * `?fx=petals` in the page URL (previews and tests only; the Android app has
 * no query string) makes a win play that preset instead of sparks.
 */
export function previewPreset(): FxPreset | null {
  if (typeof location === "undefined") return null;
  const q = new URLSearchParams(location.search).get("fx");
  return FX_PRESETS.includes(q as FxPreset) ? (q as FxPreset) : null;
}

declare global {
  interface Window {
    /** Tests fire presets and watch the loop (tests/e2e/test_fx_layer.py). */
    __rnFx?: typeof fx;
  }
}
if (typeof window !== "undefined") window.__rnFx = fx;
