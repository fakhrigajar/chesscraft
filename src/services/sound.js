let context;
const blockEffects = {
  'block-add': 'click.mp3',
  'block-remove': 'delete.mp3',
};
const blockBuffers = new Map();
const activeBlockSounds = new Set();
let soundEnabled = false;
let playbackGeneration = 0;

export function setSoundEnabled(enabled) {
  if (soundEnabled && !enabled) {
    playbackGeneration++;
    for (const source of activeBlockSounds) {
      try { source.stop(); } catch { /* The clip may already have ended. */ }
    }
    activeBlockSounds.clear();
  }
  soundEnabled = enabled;
}

function loadBlockSound(file, audio) {
  if (!blockBuffers.has(file)) {
    const loading = fetch(`${import.meta.env.BASE_URL}blockly-media/${file}`)
      .then(response => {
        if (!response.ok) throw new Error('Sound could not load');
        return response.arrayBuffer();
      })
      .then(bytes => audio.decodeAudioData(bytes))
      .catch(() => {
        blockBuffers.delete(file);
        return null;
      });
    blockBuffers.set(file, loading);
  }
  return blockBuffers.get(file);
}

function playBlockSound(file, audio) {
  const generation = playbackGeneration;
  loadBlockSound(file, audio).then(buffer => {
    if (!buffer || !soundEnabled || generation !== playbackGeneration) return;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    activeBlockSounds.add(source);
    source.onended = () => {
      activeBlockSounds.delete(source);
      source.disconnect();
    };
    source.start();
  }).catch(() => { /* Missing or blocked audio never interrupts editing. */ });
}

// Unlock audio during the click/key/drag gesture, before Blockly's queued events.
export function prepareSound(enabled) {
  setSoundEnabled(enabled);
  if (!enabled) return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state !== 'running') context.resume().catch(() => {});
    for (const file of Object.values(blockEffects)) loadBlockSound(file, context);
    return context;
  } catch { /* Audio may be unavailable or blocked by the browser. */ }
}

// Chess sounds are modelled on real objects rather than played as beeps: a
// wooden piece landing on a board, and a mallet striking marimba bars. Small
// random variations keep repeated moves from sounding mechanical.
const vary = (value, amount = 0.04) => value * (1 + (Math.random() * 2 - 1) * amount);
let room, noise;

// A short, soft room reflection shared by every chess sound.
function output(audio) {
  if (room?.context === audio) return room.input;
  const input = audio.createGain(), wet = audio.createGain(), reverb = audio.createConvolver();
  const length = Math.floor(audio.sampleRate * 0.45), impulse = audio.createBuffer(2, length, audio.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  reverb.buffer = impulse;
  wet.gain.value = 0.16;
  input.connect(audio.destination);
  input.connect(reverb).connect(wet).connect(audio.destination);
  room = { context: audio, input };
  return input;
}

function noiseBuffer(audio) {
  if (noise?.sampleRate === audio.sampleRate) return noise;
  noise = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.25), audio.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

function decayingTone(audio, destination, frequency, start, level, decay, type = 'sine') {
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  osc.connect(gain).connect(destination);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  osc.start(start);
  osc.stop(start + decay + 0.02);
}

function noiseBurst(audio, destination, start, level, decay, frequency, q) {
  const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
  source.buffer = noiseBuffer(audio);
  source.playbackRate.value = vary(1, 0.1);
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = q;
  gain.gain.setValueAtTime(level, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  source.connect(filter).connect(gain).connect(destination);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  source.start(start, Math.random() * 0.15);
  source.stop(start + decay + 0.02);
}

// Felt-bottomed wood on a wooden board: a bright contact click, the piece's
// short resonances, and a low knock from the board itself.
function woodKnock(audio, destination, start, level = 1, pitch = 1) {
  noiseBurst(audio, destination, start, 0.32 * level, 0.03, vary(2600 * pitch, 0.08), 1.1);
  for (const [frequency, amount, decay] of [[540, 0.16, 0.09], [1210, 0.09, 0.06], [2380, 0.05, 0.035]])
    decayingTone(audio, destination, vary(frequency * pitch), start, amount * level, vary(decay, 0.1));
  decayingTone(audio, destination, vary(150 * pitch), start, 0.2 * level, 0.07);
}

// Marimba: a soft mallet click, then a warm fundamental with the bar's
// inharmonic overtones (about 4x and 9.2x) fading out faster.
function marimba(audio, destination, frequency, start, level = 1) {
  noiseBurst(audio, destination, start, 0.05 * level, 0.015, frequency * 4, 2);
  decayingTone(audio, destination, frequency, start, 0.13 * level, 0.9);
  decayingTone(audio, destination, frequency * 3.99, start, 0.035 * level, 0.25);
  decayingTone(audio, destination, frequency * 9.2, start, 0.012 * level, 0.08);
}

// Small wind chimes: thin metal tubes with long, gently beating partials.
function chimes(audio, destination, start) {
  [2093, 2637, 3136, 3520, 4186].forEach((frequency, i) => {
    const at = start + i * vary(0.07, 0.3), base = vary(frequency, 0.01);
    decayingTone(audio, destination, base, at, 0.022, 1.4);
    decayingTone(audio, destination, base * 2.76, at, 0.008, 0.6);
  });
}

export function playSound(enabled, kind = 'move') {
  const audio = prepareSound(enabled);
  if (!audio) return;
  try {
    if (blockEffects[kind]) {
      playBlockSound(blockEffects[kind], audio);
      return;
    }
    const destination = output(audio), now = audio.currentTime + 0.01;
    if (kind === 'capture') {
      woodKnock(audio, destination, now, 0.55, 1.12);
      woodKnock(audio, destination, now + vary(0.075, 0.15), 1.1, 0.94);
    } else if (kind === 'correct') {
      [523.25, 783.99].forEach((frequency, i) => marimba(audio, destination, frequency, now + i * 0.11));
    } else if (kind === 'complete') {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => marimba(audio, destination, frequency, now + i * 0.1, i === 3 ? 1.2 : 1));
      chimes(audio, destination, now + 0.42);
    } else woodKnock(audio, destination, now);
  } catch { /* Sound is optional; blocked audio never affects a move. */ }
}
