// Short, layered mechanical voices. The AudioContext is only opened after the listener opts in.
export function createAudio() {
  let context;
  let master;
  let noise;
  let roller;
  let rollingGain;
  let rollingFilter;
  let pan;
  let enabled = false;
  let disposed = false;

  async function enable(value) {
    if (disposed) return false;
    enabled = Boolean(value);
    if (!enabled && !context) return false;
    try {
      if (!context) {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) { enabled = false; return false; }
        context = new Audio();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.45), context.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        roller = context.createBufferSource();
        roller.buffer = noise;
        roller.loop = true;
        rollingFilter = context.createBiquadFilter();
        rollingFilter.type = 'bandpass';
        rollingFilter.Q.value = 1.4;
        rollingGain = context.createGain();
        rollingGain.gain.value = 0;
        pan = context.createStereoPanner();
        roller.connect(rollingFilter).connect(rollingGain).connect(pan).connect(master);
        roller.start();
      }
      master.gain.setTargetAtTime(enabled ? 0.58 : 0, context.currentTime, 0.008);
      if (enabled && context.state !== 'running') await context.resume();
      return enabled && !disposed;
    } catch {
      enabled = false;
      return false;
    }
  }

  function envelope(start, amplitude, duration) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(amplitude, start + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(master);
    return gain;
  }

  function tone(start, hz, endHz, length, volume, wave = 'sine') {
    const source = context.createOscillator();
    const gain = envelope(start, volume, length);
    source.type = wave;
    source.frequency.setValueAtTime(hz, start);
    source.frequency.exponentialRampToValueAtTime(endHz, start + length);
    source.connect(gain);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(start);
    source.stop(start + length + 0.005);
  }

  function rattle(start, hz, length, volume, q = 0.9) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = hz;
    filter.Q.value = q;
    const gain = envelope(start, volume, length);
    source.connect(filter).connect(gain);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(start, Math.random() * 0.04);
    source.stop(start + length + 0.005);
  }

  function play(name, strength = 1) {
    if (!enabled || disposed || !context || context.state !== 'running') return;
    const t = context.currentTime;
    const force = Math.min(1, Math.max(0.15, Number(strength) || 1));
    switch (name) {
      case 'spring':
        tone(t, 310 + force * 130, 190 + force * 120, .07, .06, 'triangle');
        rattle(t, 1160, .045, .09 * force);
        break;
      case 'launch':
        rattle(t, 2300, 0.045, 0.47);
        tone(t + 0.009, 240, 75, 0.18, 0.23, 'triangle');
        rattle(t + 0.04, 680, 0.28, 0.20);
        break;
      case 'flip':
        rattle(t, 3100, 0.032, 0.4);
        tone(t, 155, 74, 0.057, 0.28, 'triangle');
        break;
      case 'bumper':
        tone(t, 168, 54, 0.12, 0.38 * force);
        rattle(t, 980, 0.041, 0.31 * force);
        break;
      case 'drop-target':
        rattle(t, 1680, .038, .26 * force);
        tone(t + .015, 260, 125, .077, .17 * force, 'triangle');
        break;
      case 'spinner':
        for (let i = 0; i < 4; i++) {
          rattle(t + i * .023 + i * i * .002, 2450, .018, (.16 - i * .027) * force);
        }
        break;
      case 'captive':
        tone(t, 1490, 940, .105, .19, 'triangle');
        rattle(t + .018, 2020, .11, .20);
        break;
      case 'rollover':
        tone(t, 660, 650, .13, .11 * force);
        tone(t + .008, 1320, 1296, .066, .048 * force);
        break;
      case 'rail':
        tone(t, 1270, 1080, 0.081, 0.14 * force);
        rattle(t, 2700, 0.024, 0.22 * force);
        break;
      case 'gate':
        rattle(t, 1330, 0.115, 0.35);
        tone(t + 0.09, 350, 150, 0.048, 0.16, 'triangle');
        break;
      case 'arrive':
        tone(t, 780, 755, 0.19, 0.14);
        tone(t, 1570, 1530, 0.083, 0.07);
        rattle(t + 0.094, 1800, 0.028, 0.24);
        break;
      case 'drain':
        tone(t, 122, 47, 0.19, 0.28);
        rattle(t + 0.05, 570, 0.13, 0.2);
        break;
      case 'secret':
        [392, 494, 587].forEach((hz, i) => {
          tone(t + i * 0.10, hz * 1.01, hz, 0.23, 0.12);
          rattle(t + i * 0.10, 2250, 0.025, 0.08);
        });
        break;
    }
  }

  function roll(speed, position = 0, onRail = false) {
    if (!rollingGain || disposed || !enabled) return;
    const t = context.currentTime;
    const movement = Math.min(1, Math.max(0, speed) / 1.8);
    rollingGain.gain.setTargetAtTime(movement * (onRail ? .105 : .05), t, .05);
    rollingFilter.frequency.setTargetAtTime((onRail ? 880 : 290) + movement * 280, t, .07);
    pan.pan.setTargetAtTime(position, t, .06);
  }

  function dispose() {
    disposed = true;
    enabled = false;
    if (context && context.state !== 'closed') context.close().catch(() => {});
  }

  return { enable, play, roll, dispose };
}
