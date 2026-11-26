// Screenshot staging: ?shot=title|chase|cockpit|landing boots the game into
// a deterministic pre-filled state so screenshots show the real game at its
// best. Normal play (no parameter) is completely unaffected.
(function () {
  'use strict';
  var SC = window.SC;
  var cfg = SC.config;

  function parseShot() {
    try {
      var q = new URLSearchParams(window.location.search);
      var s = q.get('shot');
      if (['title', 'chase', 'cockpit', 'landing'].indexOf(s) >= 0) return s;
    } catch (e) { /* no query string: normal play */ }
    return null;
  }

  // Place the plane on sortie 2's climb toward the volcano ring: the gold
  // ring hangs in front of the smoking cone, coast and sea spread below.
  function stageAirborne(game, view) {
    game.startSortie(1);
    var p = game.plane;
    p.x = -600; p.y = 720; p.z = 488;
    p.heading = 303; p.pitch = -1; p.roll = -13;
    p.speed = 54; p.vspeed = 3.1; p.throttle = 0.78;
    p.gearDown = false; p.flaps = false; p.onGround = false;
    p.fuel = 74; p.hull = 100;
    // Four rings already collected; the volcano ring is next (5/7).
    for (var i = 0; i < 4; i++) game.sortie.rings[i].passed = true;
    game.sortie.ringsDone = 4;
    game.sortie.elapsed = 152;
    game.view = view;
    game.screen = 'fly';
    game.snapCamera();
  }

  // Final approach to runway 09: gear down, flaps out, PAPI in sight.
  function stageLanding(game) {
    game.startSortie(0);
    var p = game.plane;
    var rw = cfg.runway;
    p.x = rw.cx - 680; p.y = rw.cy + 4; p.z = rw.elev + 19;
    p.heading = 90; p.pitch = -3; p.roll = 2;
    p.speed = 33; p.vspeed = -2.4; p.throttle = 0.34;
    p.gearDown = true; p.flaps = true; p.onGround = false;
    p.fuel = 41; p.hull = 100;
    game.sortie.rings.forEach(function (r) { r.passed = true; });
    game.sortie.ringsDone = game.sortie.rings.length;
    game.sortie.elapsed = 196;
    game.view = 'chase';
    game.screen = 'fly';
    game.snapCamera();
  }

  function stageTitle(game) {
    game.startSortie(0);
    game.screen = 'title';
    game.view = 'title';
    game.snapCamera();
  }

  SC.shots = {
    parseShot: parseShot,
    stage: function (game, shot) {
      if (shot === 'title') stageTitle(game);
      else if (shot === 'chase') stageAirborne(game, 'chase');
      else if (shot === 'cockpit') stageAirborne(game, 'cockpit');
      else if (shot === 'landing') stageLanding(game);
      game.frozen = true;
      game.time = 12.5; // fixed clock: smoke, pulses and beams are stable
    }
  };
})();
