import createSharkBoy from './sharkboy.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const status = $('status');
const keys = new Map([
  ['KeyW', 0], ['KeyS', 1], ['ArrowUp', 2], ['ArrowDown', 3],
  ['KeyA', 4], ['ArrowLeft', 4], ['KeyD', 5], ['ArrowRight', 5]
]);
const heldKeys = new Set();
const pointers = new Map();
const controls = [...document.querySelectorAll('[data-control]')];
let runtime = null;
let loading = false;
let ready = false;
let paused = false;
let muted = false;
let lastState = '';

function sendInput() {
  let bits = 0;
  for (const code of heldKeys) bits |= 1 << keys.get(code);
  for (const bit of pointers.values()) bits |= 1 << bit;
  for (const button of controls) button.classList.toggle('held', !!(bits & (1 << Number(button.dataset.control))));
  runtime?._web_input(bits);
}
function clearInput() { heldKeys.clear(); pointers.clear(); sendInput(); }
function alignConsole() {
  if (matchMedia('(pointer: coarse)').matches) $('console').scrollIntoView({block: 'start', behavior: 'auto'});
}
function focusGame() {
  alignConsole();
  canvas.focus({preventScroll: true});
}
function setPause(value) {
  if (!ready) return;
  paused = value;
  clearInput();
  runtime._web_pause(value ? 1 : 0);
  $('pause').textContent = value ? 'Resume' : 'Pause';
  $('overlay').hidden = !value;
  $('overlay-title').textContent = 'Take your time.';
  $('start').textContent = 'Resume arcade →';
  $('start').disabled = false;
  status.textContent = value ? 'Paused. Resume when you’re ready.' : 'Back in the arcade.';
  lastState = '';
  if (!value) { runtime._web_resume_audio(); focusGame(); }
}
function fail(message) {
  ready = false;
  loading = false;
  clearInput();
  runtime?._web_pause(1);
  $('overlay').hidden = false;
  $('overlay-title').textContent = 'The arcade could not start.';
  $('start').disabled = false;
  $('start').textContent = 'Reload arcade';
  $('start').onclick = () => location.reload();
  status.textContent = message;
  for (const id of ['pause', 'menu', 'restart', 'cartridge']) $(id).disabled = true;
}
async function start() {
  if (ready) { setPause(false); return; }
  if (loading) return;
  loading = true;
  $('start').disabled = true;
  $('start').textContent = 'Loading…';
  $('overlay-title').textContent = 'Getting the arcade ready.';
  status.textContent = 'Loading the cartridge collection…';
  try {
    runtime = await createSharkBoy({
      canvas,
      noInitialRun: true,
      print: () => {},
      printErr: message => console.warn('[SharkBoy]', message),
      onAbort: () => fail('The game stopped. Reload the arcade to try again.'),
      onExit: () => fail('The display could not start. Try a browser with WebGL enabled.')
    });
    runtime._web_mute(muted ? 1 : 0);
    $('overlay').hidden = true;
    runtime.callMain([]);
    const deadline = performance.now() + 20000;
    while (!runtime._web_ready()) {
      if (performance.now() > deadline) throw new Error('Startup timed out.');
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    ready = true;
    loading = false;
    $('cartridge').replaceChildren();
    for (let index = 0; index < runtime._web_count(); index++) {
      const name = runtime.UTF8ToString(runtime._web_title(index));
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = name;
      $('cartridge').append(option);
    }
    for (const id of ['pause', 'menu', 'restart', 'cartridge']) $(id).disabled = false;
    document.querySelector('.power').classList.add('on');
    document.querySelector('.power').setAttribute('aria-label', 'Power on');
    if (!runtime._web_audio()) {
      $('audio-status').hidden = false;
      $('audio-status').textContent = 'Sound is unavailable. You can keep playing muted.';
    }
    runtime._web_resume_audio();
    if (document.hidden || !document.hasFocus()) setPause(true);
    else focusGame();
    refresh();
  } catch (error) {
    console.error(error);
    fail('Could not load SharkBoy. Check your connection and try reloading.');
  }
}
function refresh() {
  if (!ready) return;
  const screen = runtime._web_screen();
  const selected = runtime._web_selected();
  const title = runtime.UTF8ToString(runtime._web_title(selected));
  canvas.dataset.screen = String(screen);
  canvas.dataset.selected = String(selected);
  canvas.dataset.paused = String(paused);
  canvas.dataset.time = String(Math.round(runtime._web_time()));
  canvas.dataset.input = String(runtime._web_input_state());
  const state = `${screen}:${selected}:${paused}`;
  if (state !== lastState) {
    lastState = state;
    if (!paused) status.textContent = screen === 1 ? `Cartridge: ${title}` : `Playing: ${title}`;
    $('cartridge').value = String(selected);
  }
  setTimeout(refresh, 100);
}
$('start').addEventListener('click', start);
$('pause').addEventListener('click', () => setPause(!paused));
for (const [id, action] of [['menu', 1], ['restart', 2]]) {
  $(id).addEventListener('click', () => { if (ready) { setPause(false); runtime._web_command(action); } });
}
$('cartridge').addEventListener('change', () => {
  if (ready) { setPause(false); runtime._web_cartridge(Number($('cartridge').value)); }
});
$('sound').addEventListener('click', () => {
  muted = !muted;
  runtime?._web_mute(muted ? 1 : 0);
  runtime?._web_resume_audio();
  $('sound').textContent = muted ? 'Unmute' : 'Mute';
  $('sound').setAttribute('aria-pressed', String(muted));
});
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('console').parentElement.requestFullscreen) await $('console').parentElement.requestFullscreen();
    else { status.textContent = 'Fullscreen is unavailable in this browser.'; return; }
    canvas.focus({preventScroll: true});
  } catch { status.textContent = 'Fullscreen is unavailable. You can keep playing here.'; }
});
document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });
canvas.addEventListener('keydown', event => {
  if (!ready || event.ctrlKey || event.metaKey || event.altKey) return;
  if (keys.has(event.code)) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!paused) { heldKeys.add(event.code); sendInput(); }
  } else if (event.code === 'Escape') { event.preventDefault(); setPause(true); }
  else if (event.code === 'KeyR' && !event.repeat && !paused) { event.preventDefault(); clearInput(); runtime._web_command(2); }
}, true);
document.addEventListener('keyup', event => {
  if (heldKeys.delete(event.code)) { event.preventDefault(); sendInput(); }
}, true);
canvas.addEventListener('blur', clearInput);
window.addEventListener('blur', () => setPause(true));
matchMedia('(orientation: landscape)').addEventListener('change', () => {
  clearInput();
  if (ready) requestAnimationFrame(alignConsole);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });
window.addEventListener('pagehide', () => { clearInput(); runtime?._web_pause(1); });
for (const button of controls) {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!ready || paused) return;
    canvas.focus({preventScroll: true});
    button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, Number(button.dataset.control));
    sendInput();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(name, event => { pointers.delete(event.pointerId); sendInput(); });
  }
  // Keep controls operable with keyboard and assistive-technology clicks too.
  button.addEventListener('click', event => {
    if (event.detail || !ready || paused) return;
    const pointer = `accessible-${button.dataset.control}`;
    pointers.set(pointer, Number(button.dataset.control)); sendInput();
    setTimeout(() => { pointers.delete(pointer); sendInput(); }, 100);
  });
}
canvas.addEventListener('pointerdown', event => {
  if (!ready || paused || event.button !== 0) return;
  canvas.focus({preventScroll: true});
  const rect = canvas.getBoundingClientRect();
  runtime._web_click(Math.floor((event.clientX - rect.left) * 240 / rect.width),
                     Math.floor((event.clientY - rect.top) * 320 / rect.height));
});
canvas.addEventListener('wheel', event => {
  if (!ready || paused || !event.deltaY) return;
  event.preventDefault();
  runtime._web_browse(event.deltaY > 0 ? 1 : -1);
}, {passive: false});
