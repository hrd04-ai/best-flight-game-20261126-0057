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

  // Place the plane mid-sortie-1, banked gently toward the next gold ring
  // with the island, volcano and lighthouse spread out ahead.
  function stageAirborne(game, view) {
    game.startSortie(0);
    var p = game.plane;
    p.x = -420; p.y = -1150; p.z = 175;
    p.heading = 62; p.pitch = 3; p.roll = -14;
    p.speed = 56; p.vspeed = 2.2; p.throttle = 0.72;
    p.gearDown = false; p.flaps = false; p.onGround = false;
    p.fuel = 86; p.hull = 100;
    // First ring already collected so the counter reads 1/5.
    game.sortie.rings[0].passed = true;
    game.sortie.ringsDone = 1;
    game.sortie.elapsed = 47;
    game.view = view;
    game.screen = 'fly';
    game.snapCamera();
  }

  // Final approach to runway 09: gear down, flaps out, PAPI in sight.
  function stageLanding(game) {
    game.startSortie(0);
    var p = game.plane;
    var rw = cfg.runway;
    p.x = rw.cx - 1500; p.y = rw.cy + 6; p.z = rw.elev + 62;
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
