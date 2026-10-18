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

export function playSound(enabled, kind = 'move') {
  const audio = prepareSound(enabled);
  if (!audio) return;
  try {
    if (blockEffects[kind]) {
      playBlockSound(blockEffects[kind], audio);
      return;
    }
    const notes = kind === 'complete' ? [523, 659, 784, 1047] : kind === 'correct' ? [523, 659] : [392];
    notes.forEach((frequency, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime+i*0.12;
      const duration = 0.22;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.07, start+0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start+duration);
      osc.connect(gain).connect(audio.destination);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      osc.start(start); osc.stop(start+duration+0.02);
    });
  } catch { /* Sound is optional; blocked audio never affects a move. */ }
}
