export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function deltaModeToPixels(deltaY, deltaMode) {
  // WheelEvent deltaMode: 0=pixel, 1=line, 2=page
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * 160;
  return deltaY;
}

export function applyWheelZoom(camera, opts) {
  const {
    deltaY,
    deltaMode = 0,
    anchorX = 0,
    anchorY = 0
  } = opts || {};

  const oldZoom = camera.zoom;
  const pixels = deltaModeToPixels(deltaY, deltaMode);

  // Exponential scale gives consistent feel across trackpad/mouse wheel.
  const rawFactor = Math.exp(-pixels * 0.0011);
  const factor = clamp(rawFactor, 0.9, 1.1);
  const nextZoom = clamp(oldZoom * factor, camera.minZoom, camera.maxZoom);
  if (nextZoom === oldZoom) return;

  // Keep world position under cursor stable while zooming.
  const worldX = (anchorX - camera.x) / oldZoom;
  const worldY = (anchorY - camera.y) / oldZoom;
  camera.zoom = nextZoom;
  camera.x = anchorX - worldX * nextZoom;
  camera.y = anchorY - worldY * nextZoom;
}

export function panCamera(camera, dx, dy) {
  camera.x += dx;
  camera.y += dy;
}

export function resetCamera(camera) {
  camera.x = 0;
  camera.y = 0;
  camera.zoom = 1;
}
