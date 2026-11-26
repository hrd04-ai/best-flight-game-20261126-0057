// Sky Courier — Island Rings: game shell.
// Screens (title / fly / pause / debrief / crash), the main loop, camera
// work and wiring between flight model, missions, renderer and HUD.
(function () {
  'use strict';
  var SC = window.SC;
  var cfg = SC.config;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  SC.input.init(canvas);

  var game = {
    screen: 'title',        // title | fly | pause | debrief | crash
    view: 'title',          // title | chase | cockpit
    plane: SC.flight.newPlane(),
    sortie: null,
    sortieIndex: 0,
    time: 0,
    frozen: false,
    camera: { x: 0, y: 0, z: 30, heading: 90, pitch: 0, roll: 0 },
    message: '', messageUntil: 0,
    crashReason: '',
    debrief: null,
    liveScore: 0,
    unlocked: 1,
    bestScores: {},
    stallBeepAt: 0
  };

  function palette() {
    return game.sortie && game.sortie.dusk ? cfg.palettes.dusk : cfg.palettes.day;
  }

  function say(text, seconds) {
    game.message = text;
    game.messageUntil = game.time + (seconds || 2.6);
  }

  game.startSortie = function (index) {
    game.sortieIndex = index;
    game.sortie = SC.missions.cloneSortie(SC.missions.SORTIES[index]);
    game.plane = SC.flight.newPlane();
    game.plane.fuel = game.sortie.fuel;
    game.sortie.elapsed = 0;
    game.liveScore = 0;
    game.debrief = null;
    game.crashReason = '';
    game.screen = 'fly';
    game.view = 'chase';
    game.snapCamera();
    say('Sortie ' + game.sortie.id + ': ' + game.sortie.name + ' — throttle up!', 3.4);
  };

  // Put the camera exactly where the current view wants it (no smoothing).
  game.snapCamera = function () {
    var p = game.plane;
    if (game.view === 'title') {
      game.camera = titleCamera(0);
      return;
    }
    if (game.view === 'cockpit') {
      game.camera = {
        x: p.x, y: p.y, z: p.z + 1.4,
        heading: p.heading, pitch: p.pitch, roll: p.roll
      };
      return;
    }
    var back = chaseOffset(p);
    game.camera = {
      x: p.x + back.x, y: p.y + back.y, z: p.z + back.z,
      heading: p.heading, pitch: p.pitch * 0.55 - 2, roll: p.roll * 0.45
    };
  };

  function chaseOffset(p) {
    var h = SC.rad(p.heading);
    return {
      x: -Math.sin(h) * cfg.camera.chaseBack,
      y: -Math.cos(h) * cfg.camera.chaseBack,
      z: cfg.camera.chaseUp
    };
  }

  function titleCamera(t) {
    var p = game.plane;
    var ang = SC.rad(38 + (game.frozen ? 0 : Math.sin(t * 0.07) * 16));
    var dist = 46;
    var cx = p.x + Math.sin(ang) * dist;
    var cy = p.y - Math.cos(ang) * dist;
    var cz = p.z + 9;
    // Look at the plane, island and volcano beyond it.
    var dx = p.x - cx, dy = p.y - cy, dz = (p.z + 2) - cz;
    var heading = SC.deg(Math.atan2(dx, dy));
    var pitch = SC.deg(Math.atan2(dz, Math.hypot(dx, dy)));
    return { x: cx, y: cy, z: cz, heading: heading, pitch: pitch, roll: 0 };
  }

  function updateCamera(dt) {
    var p = game.plane;
    if (game.view === 'title') {
      game.camera = titleCamera(game.time);
      return;
    }
    if (game.view === 'cockpit') {
      game.camera.x = p.x; game.camera.y = p.y; game.camera.z = p.z + 1.4;
      game.camera.heading = p.heading;
      game.camera.pitch = p.pitch;
      game.camera.roll = p.roll;
      return;
    }
    // Chase: lagged position, attitude follows softly — never fights the pilot.
    var back = chaseOffset(p);
    var tx = p.x + back.x, ty = p.y + back.y, tz = p.z + back.z;
    var k = game.frozen ? 1 : SC.clamp(dt * 4.2, 0, 1);
    game.camera.x = SC.lerp(game.camera.x, tx, k);
    game.camera.y = SC.lerp(game.camera.y, ty, k);
    game.camera.z = SC.lerp(game.camera.z, tz, k);
    var dh = SC.angleDiff(p.heading, game.camera.heading);
    game.camera.heading = SC.wrap360(game.camera.heading + dh * SC.clamp(dt * 3.4, 0, 1));
    game.camera.pitch = SC.lerp(game.camera.pitch, p.pitch * 0.55 - 2, SC.clamp(dt * 3, 0, 1));
    game.camera.roll = SC.lerp(game.camera.roll, p.roll * 0.45, SC.clamp(dt * 3, 0, 1));
    // Never let the chase cam go under the ground.
    var minZ = SC.terrain.surfaceHeight(game.camera.x, game.camera.y) + 2.2;
    if (game.camera.z < minZ) game.camera.z = minZ;
  }

  function handleEvents(events) {
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.type === 'liftoff') say('Airborne — climb to the gold ring', 2.4);
      else if (e.type === 'touchdown') {
        SC.audio.touchdownThud(e.grade === 'HARD');
        say(e.grade + ' LANDING — ' + e.reason, 3.2);
        if (e.damage > 0) say(e.grade + ' — hull -' + e.damage + '%', 3.2);
      } else if (e.type === 'crash') {
        game.crashReason = e.reason;
        game.screen = 'crash';
        SC.audio.crashBang();
        SC.world.spawnExplosion(game.plane.x, game.plane.y, game.plane.z);
      } else if (e.type === 'stall') {
        if (game.time - game.stallBeepAt > 0.5) {
          game.stallBeepAt = game.time;
          SC.audio.warningBeep();
        }
      } else if (e.type === 'edge') {
        say('Turn back — the mail route stays over the island', 2.2);
      }
    }
  }

  function finishSortie() {
    var score = SC.missions.scoreSortie(game.sortie, game.plane);
    game.debrief = score;
    game.screen = 'debrief';
    var id = game.sortie.id;
    if (!game.bestScores[id] || score.total > game.bestScores[id]) game.bestScores[id] = score.total;
    if (id >= game.unlocked && id < SC.missions.SORTIES.length) game.unlocked = id + 1;
    SC.audio.fanfare();
  }

  function stepGame(dt) {
    var p = game.plane;
    var input = SC.input.axes();

    if (SC.input.wasPressed('c') && game.screen === 'fly') {
      game.view = game.view === 'chase' ? 'cockpit' : 'chase';
      game.snapCamera();
      say(game.view === 'cockpit' ? 'Cockpit view' : 'Chase view', 1.4);
    }
    if (SC.input.wasPressed('g') && game.screen === 'fly') {
      p.gearDown = !p.gearDown;
      SC.audio.gearClunk();
      say(p.gearDown ? 'Gear down' : 'Gear up', 1.4);
    }
    if (SC.input.wasPressed('f') && game.screen === 'fly') {
      p.flaps = !p.flaps;
      SC.audio.flapWhir();
      say(p.flaps ? 'Flaps down' : 'Flaps up', 1.4);
    }
    if (SC.input.wasPressed('m')) {
      say(SC.audio.toggleMute() ? 'Sound off' : 'Sound on', 1.2);
    }
    if (SC.input.wasPressed('p') && (game.screen === 'fly' || game.screen === 'pause')) {
      game.screen = game.screen === 'fly' ? 'pause' : 'fly';
    }
    if (SC.input.wasPressed('r') && (game.screen === 'crash' || game.screen === 'debrief' || game.screen === 'pause')) {
      game.startSortie(game.sortieIndex);
    }

    if (game.screen === 'fly') {
      game.sortie.elapsed += dt;
      var events = [];
      SC.flight.step(p, input, game.sortie, game.time, dt, events);
      handleEvents(events);
      var passed = SC.missions.checkRingPass(game.sortie, p);
      if (passed) {
        SC.audio.ringChime();
        var left = game.sortie.rings.length - game.sortie.ringsDone;
        say(left > 0 ? 'Ring ' + game.sortie.ringsDone + ' delivered — ' + left + ' to go'
                     : 'All rings delivered — land on runway 09/27', 2.8);
      }
      // Sortie complete: stopped on the ground with every ring flown.
      if (p.onGround && p.speed < 2.5 && game.sortie.ringsDone === game.sortie.rings.length &&
          p.lastTouchdown && game.sortie.elapsed > 5) {
        finishSortie();
      }
      game.liveScore = SC.missions.scoreSortie(game.sortie, p).total;
      SC.audio.updateEngine(p.throttle, p.speed, p.engineOn, dt);
    } else {
      SC.audio.updateEngine(0, 0, false, dt);
    }
    updateCamera(dt);
  }

  // --- Screens drawn over the world ------------------------------------

  function drawTitle() {
    var cx = W / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(6,14,24,0.42)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd23f';
    ctx.font = '900 ' + Math.round(Math.min(64, W * 0.055)) + 'px system-ui, sans-serif';
    ctx.fillText('SKY COURIER', cx, H * 0.16);
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '800 ' + Math.round(Math.min(30, W * 0.028)) + 'px system-ui, sans-serif';
    ctx.fillText('— ISLAND RINGS —', cx, H * 0.16 + 38);
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = '#bfe9ff';
    ctx.fillText('Fly the mail plane Kestrel: thread the delivery rings, then grease the landing.', cx, H * 0.16 + 68);

    var boxW = Math.min(620, W * 0.86), boxX = cx - boxW / 2, boxY = H * 0.34;
    ctx.fillStyle = 'rgba(8,18,28,0.66)';
    ctx.strokeStyle = 'rgba(140,220,255,0.4)';
    ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, 190, 12); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left';
    SC.missions.SORTIES.forEach(function (s, i) {
      var y = boxY + 36 + i * 52;
      var locked = s.id > game.unlocked;
      ctx.fillStyle = locked ? '#6f93ad' : '#ffd23f';
      ctx.font = '800 19px system-ui, sans-serif';
      ctx.fillText('[' + s.id + ']  SORTIE ' + s.id + ' — ' + s.name.toUpperCase(), boxX + 22, y);
      ctx.fillStyle = locked ? '#5c7a91' : '#cfe9fa';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText(locked ? 'Finish the previous sortie to unlock' : s.brief, boxX + 22, y + 19);
      var best = game.bestScores[s.id];
      if (best) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#57e389';
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillText('BEST ' + best, boxX + boxW - 22, y);
        ctx.textAlign = 'left';
      }
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText('Press 1, 2 or 3 to fly  •  Shift/Ctrl throttle  •  Arrows or mouse steer  •  C camera  •  G gear  •  F flaps', cx, boxY + 218);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = '#8fd0f5';
    ctx.fillText('Rotate at 55 kt. Watch the stall, mind the fuel, land slow and shallow on runway 09/27.', cx, boxY + 242);
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(6,14,24,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', W / 2, H * 0.38);
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = '#bfe9ff';
    var lines = [
      'Throttle: Shift / Ctrl, W / S, mouse wheel      Pitch: ↑ ↓ or mouse',
      'Roll: ← →, A / D or mouse      Rudder: Q / E      Brake: B',
      'Flaps: F      Gear: G      Camera: C      Mute: M',
      'P — resume      R — restart sortie'
    ];
    lines.forEach(function (l, i) { ctx.fillText(l, W / 2, H * 0.38 + 44 + i * 26); });
  }

  function drawDebrief() {
    var s = game.sortie, d = game.debrief;
    ctx.fillStyle = 'rgba(6,14,24,0.55)';
    ctx.fillRect(0, 0, W, H);
    var boxW = Math.min(560, W * 0.88), boxX = W / 2 - boxW / 2, boxY = H * 0.20, boxH = 330;
    ctx.fillStyle = 'rgba(8,18,28,0.85)';
    ctx.strokeStyle = 'rgba(140,220,255,0.45)';
    ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 14); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '900 30px system-ui, sans-serif';
    ctx.fillText('SORTIE ' + s.id + ' COMPLETE', W / 2, boxY + 46);
    ctx.fillStyle = '#ffd23f';
    ctx.font = '900 34px system-ui, sans-serif';
    var stars = '';
    for (var i = 0; i < 3; i++) stars += i < d.stars ? '★' : '☆';
    ctx.fillText(stars, W / 2, boxY + 90);
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillStyle = '#eaf7ff';
    var mm = Math.floor(s.elapsed / 60), ss = Math.floor(s.elapsed % 60);
    var rows = [
      'Rings delivered: ' + s.ringsDone + '/' + s.rings.length + '   (+' + d.ringPts + ')',
      'Landing: ' + (d.grade || '—') + '   (+' + d.landingPts + ')',
      'Time: ' + mm + ':' + String(ss).padStart(2, '0') + '   (bonus +' + d.timeBonus + ')',
      'Damage penalty: −' + d.damagePenalty,
      'Hull remaining: ' + Math.round(game.plane.hull) + '%'
    ];
    rows.forEach(function (r, i2) { ctx.fillText(r, W / 2, boxY + 130 + i2 * 28); });
    ctx.font = '900 30px system-ui, sans-serif';
    ctx.fillStyle = '#57e389';
    ctx.fillText('SCORE ' + d.total, W / 2, boxY + 292);
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = '#bfe9ff';
    var nextHint = s.id < SC.missions.SORTIES.length ? 'Enter — next sortie      ' : 'All sorties flown — you are the island\'s finest courier!      ';
    ctx.fillText(nextHint + 'R — fly again      Esc — title', W / 2, boxY + boxH + 34);
  }

  function drawCrash() {
    ctx.fillStyle = 'rgba(24,6,4,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.font = '900 48px system-ui, sans-serif';
    ctx.fillText('CRASHED', W / 2, H * 0.34);
    ctx.fillStyle = '#ffd9d2';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(game.crashReason, W / 2, H * 0.34 + 40);
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = '#bfe9ff';
    ctx.fillText('Rings delivered before the end: ' + game.sortie.ringsDone + '/' + game.sortie.rings.length, W / 2, H * 0.34 + 76);
    ctx.fillText('R — try the sortie again      Esc — title', W / 2, H * 0.34 + 108);
  }

  function handleScreenKeys() {
    if (game.screen === 'title') {
      for (var i = 0; i < SC.missions.SORTIES.length; i++) {
        if (SC.input.wasPressed(String(i + 1)) && SC.missions.SORTIES[i].id <= game.unlocked) {
          game.startSortie(i);
          return;
        }
      }
    }
    if (game.screen === 'debrief' && SC.input.wasPressed('enter')) {
      if (game.sortieIndex + 1 < SC.missions.SORTIES.length) game.startSortie(game.sortieIndex + 1);
    }
    if (SC.input.wasPressed('escape') && game.screen !== 'title') {
      game.screen = 'title';
      game.view = 'title';
      game.plane = SC.flight.newPlane();
      game.snapCamera();
    }
  }

  // --- Boot -------------------------------------------------------------
  game.sortie = SC.missions.cloneSortie(SC.missions.SORTIES[0]);
  game.snapCamera();
  var shot = SC.shots.parseShot();
  if (shot) SC.shots.stage(game, shot);

  var lastTs = performance.now();
  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    if (!game.frozen) {
      game.time += dt;
      handleScreenKeys();
      stepGame(dt);
      SC.input.endFrame();
    }
    var fov = cfg.camera.fovDeg + (game.view === 'chase' ? SC.clamp(game.plane.speed * 0.09, 0, 7) : 0);
    var drawn = SC.world.drawScene(ctx, W, H, {
      camera: game.camera,
      plane: game.plane,
      sortie: game.sortie,
      pal: palette(),
      view: game.view,
      time: game.time,
      dt: game.frozen ? 0 : dt,
      frozen: game.frozen,
      fov: fov
    });
    if (game.screen === 'title') {
      drawTitle();
    } else {
      if (game.view === 'cockpit') SC.cockpit.drawCockpit(ctx, W, H, game.plane, game.time);
      SC.hud.drawHud(ctx, W, H, {
        plane: game.plane, sortie: game.sortie, view: game.view,
        time: game.time, liveScore: game.liveScore,
        message: game.message, messageUntil: game.messageUntil,
        camera: game.camera, basis: drawn.basis, focal: drawn.focal
      });
      if (game.screen === 'pause') drawPause();
      else if (game.screen === 'debrief') drawDebrief();
      else if (game.screen === 'crash') drawCrash();
    }
    if (!window.__SC_READY) window.__SC_READY = true;
  }
  requestAnimationFrame(frame);

  // Hooks for automated play-tests and screenshot staging.
  SC.game = game;
  window.__SC = SC;
})();
