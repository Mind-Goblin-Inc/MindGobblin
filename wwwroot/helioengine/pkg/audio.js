let context;
let enabled = false;
let paused = false;
const loops = new Map();
const effects = new Set();
const message = () => document.querySelector('#audio-status');
function failed(error) {
  if (message()) { message().textContent = `Audio unavailable: ${error?.message ?? error}. Use Retry audio.`; message().hidden = false; }
  document.querySelector('#retry-audio')?.removeAttribute('hidden');
}
function buffer(samples) {
  const frames = samples.length / 2;
  const result = context.createBuffer(2, frames, 44100);
  for (let channel = 0; channel < 2; channel++) {
    const data = result.getChannelData(channel);
    for (let frame = 0; frame < frames; frame++) data[frame] = samples[frame * 2 + channel];
  }
  return result;
}
function playLoop(loop) {
  if (!context || !enabled || loop.source) return;
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = loop.buffer ??= buffer(loop.samples);
  source.loop = true;
  gain.gain.value = loop.gain;
  source.connect(gain).connect(context.destination);
  source.start();
  loop.source = source;
  loop.node = gain;
}
export async function activateAudio() {
  try {
    context ??= new AudioContext();
    await context.resume();
    if (context.state !== 'running') throw new Error('The browser has paused audio');
    enabled = true;
    paused = false;
    for (const loop of loops.values()) playLoop(loop);
    context.onstatechange = () => {
      if (enabled && !paused && !document.hidden && context.state !== 'running') failed(new Error('Audio paused'));
    };
    message().textContent = '';
    message().hidden = true;
    document.querySelector('#retry-audio').hidden = true;
  } catch (error) { failed(error); throw error; }
}
export function muteAudio() { enabled = false; void context?.suspend().catch(failed); }
export function pauseAudio() {
  paused = true;
  for (const source of effects) { try { source.stop(); } catch {} source.disconnect(); }
  effects.clear();
  void context?.suspend().catch(failed);
}
export function resumeAudio() {
  paused = false;
  if (enabled) void context?.resume().catch(failed);
}
export function audio_loop(samples, slot, gain) {
  audio_stop(slot);
  try {
    const loop = { samples: new Float32Array(samples), gain };
    loops.set(slot, loop);
    playLoop(loop);
  } catch (error) { failed(error); }
}
export function audio_stop(slot) {
  const loop = loops.get(slot);
  if (loop?.source) { loop.source.stop(); loop.source.disconnect(); loop.node.disconnect(); }
  loops.delete(slot);
}
export function audio_gain(slot, gain) {
  const loop = loops.get(slot);
  if (loop) { loop.gain = gain; if (loop.node) loop.node.gain.value = gain; }
}
export function audio_effect(samples) {
  if (!enabled || !context || context.state !== 'running') return;
  try {
    const source = context.createBufferSource();
    source.buffer = buffer(samples);
    source.connect(context.destination);
    source.onended = () => { effects.delete(source); source.disconnect(); };
    effects.add(source);
    source.start();
  } catch (error) { failed(error); }
}

export function audioState() {
  return { state: context?.state ?? 'uninitialized', enabled, paused, loops: [...loops.keys()], effects: effects.size };
}
