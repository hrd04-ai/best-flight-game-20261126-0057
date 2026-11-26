// Input: keyboard + mouse state, edge-triggered key events for toggles.
// Held keys are polled each frame; presses queue into `pressed` for one frame.
(function () {
  'use strict';
  var SC = window.SC;

  var held = {};
  var pressed = {};
  var mouse = { x: 0, y: 0, wheel: 0, down: false, moved: false };

  function onKeyDown(e) {
    var k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    if (!held[k]) pressed[k] = true;
    held[k] = true;
    SC.audio.unlock();
  }
  function onKeyUp(e) { held[e.key.toLowerCase()] = false; }

  function init(canvas) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', function (e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
      mouse.moved = true;
    });
    window.addEventListener('mousedown', function () { mouse.down = true; SC.audio.unlock(); });
    window.addEventListener('mouseup', function () { mouse.down = false; });
    window.addEventListener('wheel', function (e) {
      mouse.wheel += (e.deltaY < 0 ? 1 : -1);
    }, { passive: true });
    canvas.addEventListener('touchstart', function () { SC.audio.unlock(); }, { passive: true });
  }

  // Combined control axes in [-1, 1] from keyboard and mouse.
  function axes() {
    var pitch = 0, roll = 0, rudder = 0, throttleDelta = 0;
    if (held['arrowup']) pitch += 1;
    if (held['arrowdown']) pitch -= 1;
    if (held['arrowleft'] || held['a']) roll -= 1;
    if (held['arrowright'] || held['d']) roll += 1;
    if (held['q']) rudder -= 1;
    if (held['e']) rudder += 1;
    if (held['shift']) throttleDelta += 1;
    if (held['control']) throttleDelta -= 1;
    if (held['w']) throttleDelta += 1;
    if (held['s']) throttleDelta -= 1;
    if (mouse.moved) {
      // Mouse steers gently: left/right banks, up/down pitches (stick style:
      // mouse up = nose down is inverted here for arcade feel — mouse up climbs).
      roll += SC.clamp(mouse.x * 1.4, -1, 1) * 0.8;
      pitch += SC.clamp(-mouse.y * 1.4, -1, 1) * 0.8;
    }
    return {
      pitch: SC.clamp(pitch, -1, 1),
      roll: SC.clamp(roll, -1, 1),
      rudder: SC.clamp(rudder, -1, 1),
      throttleDelta: SC.clamp(throttleDelta, -1, 1),
      wheel: mouse.wheel,
      brake: !!held['b']
    };
  }

  SC.input = {
    init: init,
    axes: axes,
    wasPressed: function (k) { return !!pressed[k]; },
    isHeld: function (k) { return !!held[k]; },
    endFrame: function () { pressed = {}; mouse.wheel = 0; },
    mouse: mouse,
    // Test hook: synthesise a key press (used by automated play-tests).
    simulateKey: function (key, down) {
      var k = key.toLowerCase();
      if (down) { if (!held[k]) pressed[k] = true; held[k] = true; }
      else held[k] = false;
    }
  };
})();
