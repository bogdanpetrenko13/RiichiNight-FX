import { useEffect, useRef } from "react";
import { mountFxLayer } from "./fx";

/** The effects canvas over the table; takes no taps and is read by no one. */
export function FxCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return mountFxLayer(canvas);
  }, []);
  return <canvas ref={ref} className={className} data-fx aria-hidden="true" />;
}
