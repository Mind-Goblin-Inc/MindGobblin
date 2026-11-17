import { activateAudio, muteAudio } from './pkg/audio.js';
import { captureMouse, report_error, set_memory, set_load_time, snapshot } from './pkg/runtime.js';
const status = document.querySelector('#status');
const start = document.querySelector('#start');
const muted = document.querySelector('#muted');
const canvas = document.querySelector('#game');
// Use the bundled release menu's shortcuts to enter a game after startup.
const linkedGames = new Map([
  ['planet-flight', ['1', 'Digit1']],
  ['city-walk', ['2', 'Digit2']],
  ['doomlike-arena', ['3', 'Digit3']],
  ['corn-maze', ['4', 'Digit4']],
  ['starhusk-bar', ['5', 'Digit5']],
  ['zombies', ['6', 'Digit6']],
  ['liminal-office', ['7', 'Digit7']],
  ['drone-gate-runner', ['8', 'Digit8']],
  ['echolocation', ['9', 'Digit9']],
  ['voxel-sandbox', ['0', 'Digit0']],
  ['freeplay', ['f', 'KeyF']]
]);
const requestedGame = new URLSearchParams(location.search).get('game');
const linkedGame = linkedGames.get(requestedGame);
let linkedAudioPending = Boolean(linkedGame);
let started = false;
let loading = false;
let restartRequired = false;
let game;
async function openLinkedGame() {
  if (!linkedGame) return;
  let waitingSince = performance.now();
  for (;;) {
    if (status.dataset.error === 'true') throw new Error(status.textContent);
    if (document.hidden || !document.hasFocus()) waitingSince = performance.now();
    else if (snapshot()?.mode === 'GamesMenu') break;
    else if (performance.now() - waitingSince > 15000) throw new Error('The game menu could not load.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const [key, code] = linkedGame;
  for (const type of ['keydown', 'keyup']) {
    canvas.dispatchEvent(new KeyboardEvent(type, {key, code, bubbles: true, cancelable: true}));
  }
}
async function enableLinkedAudio() {
  if (!started || !linkedAudioPending) return;
  linkedAudioPending = false;
  try { await activateAudio(); }
  catch { linkedAudioPending = true; }
}
async function begin(withAudio) {
  if (started || loading) return;
  if (restartRequired) { window.location.reload(); return; }
  loading = true;
  start.disabled = muted.disabled = true;
  try {
    if (!isSecureContext || !navigator.gpu) throw new Error('HelioEngine needs desktop WebGPU over HTTPS or localhost. This browser or device does not provide it.');
    if (withAudio) {
      try { await activateAudio(); linkedAudioPending = false; }
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
    await openLinkedGame();
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
canvas.addEventListener('keydown', event => { if (event.isTrusted) void enableLinkedAudio(); });
canvas.addEventListener('pointerdown', event => { if (event.isTrusted) void enableLinkedAudio(); });
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

if (linkedGame) {
  document.querySelector('#retry-audio').textContent = 'Enable audio';
  document.querySelector('#retry-audio').hidden = false;
  const audioStatus = document.querySelector('#audio-status');
  audioStatus.textContent = requestedGame === 'echolocation'
    ? 'Echolocation uses sound. Use a game control or select Enable audio to turn sound on.'
    : 'Use a game control or select Enable audio to turn sound on.';
  audioStatus.hidden = false;
  void begin(false);
}
