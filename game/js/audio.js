// Audio: every sound is synthesized with WebAudio — no audio files.
// Engine hum pitched with throttle, ring chime, landing thud, warning beep.
(function () {
  'use strict';
  var SC = window.SC;

  var ctx = null;
  var engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  var muted = false;
  var beepTimer = 0;

  function ensureContext() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 28;
    var g2 = ctx.createGain(); g2.gain.value = 0.5;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(g2); g2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start(); engineOsc2.start();
    return ctx;
  }

  function unlock() {
    var c = ensureContext();
    if (c && c.state === 'suspended') c.resume();
  }

  // Called every frame with the plane state.
  function updateEngine(throttle, speed, engineOn, dt) {
    if (!ctx) return;
    var target = muted || !engineOn ? 0 : 0.028 + throttle * 0.075;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    var f = 48 + throttle * 120 + speed * 0.35;
    engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.06);
    engineOsc2.frequency.setTargetAtTime(f * 0.5, ctx.currentTime, 0.06);
    engineFilter.frequency.setTargetAtTime(300 + throttle * 700, ctx.currentTime, 0.1);
    if (beepTimer > 0) beepTimer -= dt;
  }

  function tone(freq, dur, type, vol, delay, slideTo) {
    var c = ensureContext();
    if (!c || muted) return;
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq) {
    var c = ensureContext();
    if (!c || muted) return;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 300;
    var g = c.createGain(); g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start();
  }

  SC.audio = {
    unlock: unlock,
    updateEngine: updateEngine,
    ringChime: function () { tone(880, 0.16, 'sine', 0.14); tone(1318, 0.3, 'sine', 0.12, 0.09); },
    touchdownThud: function (hard) { noiseBurst(hard ? 0.4 : 0.2, hard ? 0.4 : 0.2, 220); tone(70, 0.25, 'sine', 0.2, 0, 40); },
    crashBang: function () { noiseBurst(0.9, 0.5, 500); tone(50, 0.8, 'sawtooth', 0.25, 0, 24); },
    gearClunk: function () { tone(180, 0.09, 'square', 0.08); tone(120, 0.12, 'square', 0.07, 0.12); },
    flapWhir: function () { tone(300, 0.2, 'triangle', 0.06, 0, 210); },
    warningBeep: function () {
      if (beepTimer > 0) return;
      beepTimer = 0.55;
      tone(1046, 0.14, 'square', 0.07);
    },
    fanfare: function () {
      tone(523, 0.18, 'triangle', 0.14); tone(659, 0.18, 'triangle', 0.14, 0.16);
      tone(784, 0.22, 'triangle', 0.14, 0.32); tone(1046, 0.45, 'triangle', 0.15, 0.5);
    },
    toggleMute: function () {
      muted = !muted;
      if (engineGain && muted) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      return muted;
    },
    isMuted: function () { return muted; }
  };
})();
