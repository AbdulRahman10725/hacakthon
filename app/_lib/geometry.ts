import type { ViewportState } from "@/app/_stores/canvasStore";

export function screenToWorld(
  point: { x: number; y: number },
  viewport: ViewportState
): { x: number; y: number } {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  };
}

export function worldToScreen(
  point: { x: number; y: number },
  viewport: ViewportState
): { x: number; y: number } {
  return {
    x: point.x * viewport.scale + viewport.x,
    y: point.y * viewport.scale + viewport.y,
  };
}

export function clampScale(scale: number): number {
  return Math.min(4, Math.max(0.2, scale));
}
