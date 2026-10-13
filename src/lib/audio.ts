// Generative forest soundscape — pure WebAudio, no files.

let ctx: AudioContext | null = null;
let master: GainNode;
let fx: GainNode; // short sounds go through a feedback delay for "space"
let noiseBuf: AudioBuffer;
let bellTimer: ReturnType<typeof setTimeout> | null = null;
let windFilter: BiquadFilterNode;

const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];

function makeNoise(c: AudioContext) {
  const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function audioStart() {
  if (ctx) {
    ctx.resume();
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.5);
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  const c = ctx;
  master = c.createGain();
  master.gain.value = 0;
  master.gain.setTargetAtTime(0.9, c.currentTime, 1.5);
  master.connect(c.destination);

  // space: feedback delay
  fx = c.createGain();
  const delay = c.createDelay(2);
  delay.delayTime.value = 0.38;
  const fb = c.createGain();
  fb.gain.value = 0.42;
  const damp = c.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 2400;
  fx.connect(master);
  fx.connect(delay);
  delay.connect(damp);
  damp.connect(fb);
  fb.connect(delay);
  damp.connect(master);

  noiseBuf = makeNoise(c);

  // wind: filtered noise with slow LFOs
  const wind = c.createBufferSource();
  wind.buffer = noiseBuf;
  wind.loop = true;
  windFilter = c.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 420;
  windFilter.Q.value = 0.8;
  const windGain = c.createGain();
  windGain.gain.value = 0.07;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoAmt = c.createGain();
  lfoAmt.gain.value = 260;
  lfo.connect(lfoAmt).connect(windFilter.frequency);
  const lfo2 = c.createOscillator();
  lfo2.frequency.value = 0.11;
  const lfo2Amt = c.createGain();
  lfo2Amt.gain.value = 0.04;
  lfo2.connect(lfo2Amt).connect(windGain.gain);
  wind.connect(windFilter).connect(windGain).connect(master);
  wind.start();
  lfo.start();
  lfo2.start();

  // drone: low detuned pad
  const pad = c.createGain();
  pad.gain.value = 0.035;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 380;
  [55, 82.4, 110.2, 164.8].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = i % 2 ? "triangle" : "sine";
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 6;
    o.connect(lp);
    o.start();
  });
  lp.connect(pad).connect(master);

  scheduleBell();
}

export function audioStop() {
  if (!ctx) return;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
}

function scheduleBell() {
  if (bellTimer) clearTimeout(bellTimer);
  bellTimer = setTimeout(() => {
    if (ctx && master.gain.value > 0.05) {
      const n = PENTA[Math.floor(Math.random() * PENTA.length)];
      tone(880 * Math.pow(2, n / 12), 0.025, 2.5, "sine");
    }
    scheduleBell();
  }, 2500 + Math.random() * 6000);
}

function tone(freq: number, gain: number, dur: number, type: OscillatorType = "sine", when = 0) {
  if (!ctx) return;
  const c = ctx;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(fx);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Snow crunch under a footstep. */
export function sfxStep() {
  if (!ctx || master.gain.value < 0.05) return;
  const c = ctx;
  const t = c.currentTime;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1400 + Math.random() * 1200;
  f.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.09, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 2, 0.2);
}

/** Soft ping when the light touches a creature. */
export function sfxPing(hue = 0) {
  const n = PENTA[Math.floor(hue * 9.99) % PENTA.length];
  tone(660 * Math.pow(2, n / 12), 0.04, 1.2);
}

/** A wonder is caught: rising arpeggio. */
export function sfxCatch() {
  [0, 4, 7, 12, 16, 19].forEach((n, i) => tone(523.25 * Math.pow(2, n / 12), 0.07, 2.2, "sine", i * 0.08));
  [0, 7].forEach((n) => tone(130.8 * Math.pow(2, n / 12), 0.06, 3, "triangle"));
}

/** Small "tick" for layers / swarm pieces. */
export function sfxTick(i = 0) {
  tone(1046.5 * Math.pow(2, PENTA[i % PENTA.length] / 12), 0.05, 0.5, "triangle");
}

/** Something uncanny — fourth-wall moments. */
export function sfxUncanny() {
  if (!ctx) return;
  tone(220, 0.05, 2.5, "sine");
  tone(233.1, 0.05, 2.5, "sine");
}

export function setWind(intensity: number) {
  if (!ctx || !windFilter) return;
  windFilter.Q.setTargetAtTime(0.8 + intensity * 2, ctx.currentTime, 0.4);
}
