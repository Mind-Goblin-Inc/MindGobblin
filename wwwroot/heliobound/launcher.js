import { activateAudio, muteAudio } from './pkg/audio.js';
import { captureMouse, report_error, set_memory, set_load_time } from './pkg/runtime.js';
const status = document.querySelector('#status');
const start = document.querySelector('#start');
const muted = document.querySelector('#muted');
const canvas = document.querySelector('#game');
let started = false;
let loading = false;
let restartRequired = false;
let game;
async function begin(withAudio) {
  if (started || loading) return;
  if (restartRequired) { window.location.reload(); return; }
  loading = true;
  start.disabled = muted.disabled = true;
  try {
    if (!isSecureContext || !navigator.gpu) throw new Error('HelioEngine needs desktop WebGPU over HTTPS or localhost. This browser or device does not provide it.');
    if (withAudio) {
      try { await activateAudio(); }
      catch { status.textContent = 'Audio did not start. Retry audio or choose Play muted.'; status.hidden = false; return; }
    } else { muteAudio(); }
    status.textContent = 'Loading…';
    status.hidden = false;
    delete status.dataset.error;
    const began = performance.now();
    game = await import('./pkg/heliobound.js');
    const exports = await game.default();
    set_memory(exports.memory);
    // winit permits only one event loop per WASM instance, even if GPU setup fails.
    restartRequired = true;
    await game.start(canvas);
    // A panic or browser error can be reported while async startup completes.
    // Keep that diagnostic rather than clearing it and exposing a blank screen.
    if (status.dataset.error === 'true') throw new Error(status.textContent);
    started = true;
    set_load_time(performance.now() - began);
    status.textContent = '';
    status.hidden = true;
    document.querySelector('#launch-controls').hidden = true;
    start.hidden = muted.hidden = true;
    canvas.focus();
  } catch (error) {
    const message = String(error?.message ?? error);
    report_error(/reload/i.test(message) ? message : `${message} Reload this page to retry.`);
    if (restartRequired) {
      start.textContent = 'Reload page';
      muted.hidden = true;
    }
  } finally { loading = false; if (!started) start.disabled = muted.disabled = false; }
}
start.addEventListener('click', () => void begin(true));
muted.addEventListener('click', () => void begin(false));
document.querySelector('#retry-audio').addEventListener('click', () => void activateAudio().catch(() => {}));
canvas.addEventListener('click', captureMouse);
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('#screen').requestFullscreen();
  } catch (error) { const message = document.querySelector('#input-status'); message.textContent = `Fullscreen unavailable: ${error.message}`; message.hidden = false; }
}
document.querySelector('#fullscreen').addEventListener('click', toggleFullscreen);
document.querySelector('#exit-fullscreen').addEventListener('click', toggleFullscreen);
window.addEventListener('error', event => report_error(event.message));
window.addEventListener('unhandledrejection', event => report_error(String(event.reason)));
