import { pauseAudio, resumeAudio } from './audio.js';
let playing = false;
let active = !document.hidden && document.hasFocus();
const samples = new Map();
let memory;
let loadTimeMilliseconds;
export function set_load_time(value) { loadTimeMilliseconds = value; }
let latest;
let lastFrame;
export function set_memory(value) { memory = value; }
export function snapshot() { return { ...latest, loadTimeMilliseconds, wasmMemoryBytes: memory?.buffer.byteLength }; }
export function page_active() {
  const current = !document.hidden && document.hasFocus();
  if (current !== active) visibility();
  return current;
}
export function mouse_locked() { return document.pointerLockElement === document.querySelector('#game'); }
export function release_mouse() { if (document.pointerLockElement) document.exitPointerLock(); }
export function set_playing(value) { playing = value; }
export function report_error(message) {
  document.querySelector('#status').textContent = message;
  document.querySelector('#status').hidden = false;
  document.querySelector('#status').dataset.error = 'true';
  pauseAudio(); release_mouse();
}
export function frame_sample(milliseconds, mode, bytes, x, y, z, fx, fy, fz) {
  const now = performance.now();
  const entry = samples.get(mode) ?? { frames: 0, totalCpuMs: 0, maxCpuMs: 0, gpuCacheBytes: 0, intervals: [] };
  if (lastFrame?.mode === mode) {
    entry.intervals.push(now - lastFrame.time);
    if (entry.intervals.length > 3600) entry.intervals.shift();
  }
  entry.frames++; entry.totalCpuMs += milliseconds;
  entry.maxCpuMs = Math.max(entry.maxCpuMs, milliseconds);
  entry.gpuCacheBytes = Number(bytes);
  entry.wasmMemoryBytes = Math.max(entry.wasmMemoryBytes ?? 0, memory?.buffer.byteLength ?? 0);
  samples.set(mode, entry);
  lastFrame = { mode, time: now };
  latest = { mode, position: [x, y, z], forward: [fx, fy, fz], time: now, frames: entry.frames };
}
// Measurements stay on this page. CPU preparation/submission is distinct from
// the observed interval between rendered frames; neither is a GPU timestamp.
export function metrics() {
  return Object.fromEntries([...samples].map(([mode, entry]) => {
    const intervals = [...entry.intervals].sort((a, b) => a - b);
    const { intervals: _, ...value } = entry;
    return [mode, { ...value, averageCpuMs: entry.totalCpuMs / entry.frames,
      frameIntervalP50Ms: intervals[Math.floor(intervals.length * 0.5)] ?? null,
      frameIntervalP95Ms: intervals[Math.floor(intervals.length * 0.95)] ?? null,
      wasmMemoryBytes: entry.wasmMemoryBytes }];
  }));
}
function visibility() {
  active = !document.hidden && document.hasFocus();
  if (active) resumeAudio(); else { lastFrame = undefined; release_mouse(); pauseAudio(); }
}
window.addEventListener('blur', visibility);
window.addEventListener('focus', visibility);
document.addEventListener('visibilitychange', visibility);
function input_error(text) { const message = document.querySelector('#input-status'); message.textContent = text; message.hidden = false; }
export function captureMouse() {
  if (!playing) return;
  const canvas = document.querySelector('#game');
  canvas.focus();
  try {
    const result = canvas.requestPointerLock();
    result?.catch(error => { input_error(`Mouse capture failed: ${error.message}. Click the game to retry.`); });
  } catch (error) { input_error(`Mouse capture failed: ${error.message}.`); }
}
document.addEventListener('pointerlockchange', () => {
  if (mouse_locked()) { const message = document.querySelector('#input-status'); message.textContent = ''; message.hidden = true; }
});

document.addEventListener('keydown', event => {
  if (event.code === 'Escape') {
    release_mouse();
    if (document.fullscreenElement) void document.exitFullscreen().catch(error => {
      input_error(`Cannot exit fullscreen: ${error.message}`);
    });
  }
}, true);
