// Flight model: the Kestrel's state and one physics step.
// Arcade-honest: speed-dependent control authority, a real stall, ground
// effect, fuel burn, wind gusts, touchdown judgement and crash detection.
(function () {
  'use strict';
  var SC = window.SC;
  var cfg = SC.config;
  var terrain = SC.terrain;

  function newPlane() {
    var rw = cfg.runway;
    return {
      x: rw.cx - 380, y: rw.cy, z: rw.elev + cfg.plane.gearHeight,
      heading: rw.heading, pitch: 0, roll: 0,
      speed: 0, vspeed: 0, throttle: 0,
      gearDown: true, flaps: false,
      fuel: 100, hull: 100,
      onGround: true, stalled: false, engineOn: true,
      propAngle: 0, damageTaken: 0,
      lastTouchdown: null // {grade, vspeed, speed, onRunway}
    };
  }

  function stallSpeed(p) {
    return p.flaps ? cfg.plane.stallFlaps : cfg.plane.stallClean;
  }

  // Wind vector (m/s) at time t for a sortie: steady breeze plus gusts.
  function windAt(sortie, t) {
    if (!sortie || !sortie.wind) return { x: 0, y: 0, gust: 0 };
    var w = sortie.wind;
    var gust = Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.7 + 1.3) * 0.35 + Math.sin(t * 3.1) * 0.15;
    var mag = w.base + gust * w.gust;
    var dir = SC.rad(w.fromDeg);
    // Wind FROM a compass direction blows toward the opposite.
    return { x: -Math.sin(dir) * mag, y: -Math.cos(dir) * mag, gust: gust };
  }

  function judgeTouchdown(p, groundZ) {
    var rw = cfg.runway;
    var onRwy = terrain.onRunway(p.x, p.y, 6);
    var align = Math.min(
      Math.abs(SC.angleDiff(p.heading, rw.heading)),
      Math.abs(SC.angleDiff(p.heading, rw.heading + 180)));
    var sink = -p.vspeed;
    var result = { onRunway: onRwy, vspeed: p.vspeed, speed: p.speed, align: align };
    if (terrain.isWater(p.x, p.y)) {
      result.grade = 'CRASH'; result.reason = 'Ditched in the sea';
      return result;
    }
    if (!onRwy) {
      var slope = terrain.slopeAt(p.x, p.y);
      if (sink > 3.2 || p.speed > 42 || slope > 0.5) {
        result.grade = 'CRASH'; result.reason = 'Hit rough terrain';
      } else {
        result.grade = 'HARD'; result.reason = 'Rough off-field landing';
        result.damage = 22;
      }
      return result;
    }
    if (align > 42) {
      result.grade = 'CRASH'; result.reason = 'Landed across the runway';
      return result;
    }
    if (!p.gearDown) {
      result.grade = 'HARD'; result.reason = 'Belly landing — gear was up';
      result.damage = 30;
      return result;
    }
    if (sink > 5.2) {
      result.grade = 'CRASH'; result.reason = 'Slammed into the runway';
      return result;
    }
    if (sink <= 1.15 && p.speed <= 38 && align <= 12) {
      result.grade = 'GREASED'; result.reason = 'Butter-smooth touchdown';
      result.damage = 0;
    } else if (sink <= 2.4 && p.speed <= 44) {
      result.grade = 'FIRM'; result.reason = 'Firm but fine';
      result.damage = 2;
    } else {
      result.grade = 'HARD'; result.reason = 'Heavy arrival — check the gear';
      result.damage = 10 + Math.round(sink * 2);
    }
    return result;
  }

  // Advance the plane by dt seconds. `events` collects what happened so the
  // game shell can play sounds and show messages.
  function step(p, input, sortie, t, dt, events) {
    var P = cfg.plane;
    var wind = windAt(sortie, t);

    // --- throttle -------------------------------------------------------
    if (input.wheel) p.throttle = SC.clamp(p.throttle + input.wheel * 0.06, 0, 1);
    p.throttle = SC.clamp(p.throttle + input.throttleDelta * 0.55 * dt, 0, 1);
    if (p.fuel <= 0) { p.engineOn = false; p.throttle = 0; }
    if (p.engineOn) p.fuel = Math.max(0, p.fuel - P.fuelBurn * p.throttle * dt);
    p.propAngle += dt * (p.engineOn ? 12 + p.throttle * 55 : Math.max(0, 6 - p.speed * 0.1));

    // --- attitude -------------------------------------------------------
    var authority = SC.clamp(p.speed / 30, 0.3, 1.15);
    if (p.onGround) authority = SC.clamp(p.speed / 30, 0, 0.6);
    var targetRoll = input.roll * P.maxRoll;
    if (!p.onGround && sortie && sortie.wind) targetRoll += wind.gust * 7; // gusty wing-rock
    p.roll = SC.lerp(p.roll, targetRoll, SC.clamp(dt * 3.2, 0, 1));
    var pitchRate = input.pitch * 26 * authority;
    p.pitch = SC.clamp(p.pitch + pitchRate * dt, -24, P.maxPitch);
    if (!input.pitch) p.pitch = SC.lerp(p.pitch, 0, dt * 0.7);

    // Stall: nose drops on its own, controls go mushy.
    var stall = stallSpeed(p);
    p.stalled = !p.onGround && p.speed < stall;
    if (p.stalled) {
      p.pitch = SC.lerp(p.pitch, -14, dt * 2.2);
      events.push({ type: 'stall' });
    }

    // Turn: bank turns the plane; rudder adds a fine yaw.
    var turnRate = 0;
    if (!p.onGround) {
      var kt = Math.max(p.speed * 1.94384, 20);
      turnRate = 1091 * Math.tan(SC.rad(p.roll)) / kt;
    } else {
      turnRate = (input.rudder * 14 + input.roll * 10) * SC.clamp(p.speed / 12, 0, 1);
    }
    p.heading = SC.wrap360(p.heading + (turnRate + input.rudder * (p.onGround ? 0 : 4)) * dt);

    // --- speed ----------------------------------------------------------
    var thrust = p.engineOn ? p.throttle * 9.5 * (1 - p.speed / 105) : 0;
    var drag = p.speed * p.speed * 0.00062
      + (p.gearDown && !p.onGround ? p.speed * 0.012 : 0)
      + (p.flaps ? p.speed * 0.016 : 0)
      + Math.max(0, Math.sin(SC.rad(p.pitch))) * 5.2 * (p.onGround ? 0 : 1)
      + (p.onGround ? 0.7 + (input.brake ? 4.5 : 0) : 0);
    p.speed = Math.max(0, p.speed + (thrust - drag) * dt);

    // --- vertical -------------------------------------------------------
    var groundZ = terrain.surfaceHeight(p.x, p.y);
    var agl = p.z - groundZ;
    if (p.onGround) {
      p.vspeed = 0;
      p.z = groundZ + P.gearHeight;
      // Rotate and lift off.
      if (p.speed > P.rotateSpeed && p.pitch > 2.5) {
        p.onGround = false;
        p.vspeed = 1.5;
        events.push({ type: 'liftoff' });
      }
    } else {
      var liftFactor = SC.clamp(p.speed / stall, 0, 1);
      var targetV = Math.sin(SC.rad(p.pitch)) * p.speed * (0.35 + 0.65 * liftFactor);
      if (p.stalled) targetV -= (stall - p.speed) * 0.85 + 3.5;
      // Ground effect: a cushion of lift in the last few metres.
      if (agl < 7 && p.vspeed < 0) targetV *= 0.55;
      p.vspeed = SC.lerp(p.vspeed, targetV, SC.clamp(dt * 1.9, 0, 1));
      p.z += p.vspeed * dt;
      // Touchdown?
      if (p.z <= groundZ + P.gearHeight && p.vspeed <= 0.2) {
        p.z = groundZ + P.gearHeight;
        var judged = judgeTouchdown(p, groundZ);
        p.lastTouchdown = judged;
        if (judged.grade === 'CRASH') {
          events.push({ type: 'crash', reason: judged.reason });
          p.hull = 0;
        } else {
          p.onGround = true;
          p.vspeed = 0;
          p.pitch = Math.min(p.pitch, 2);
          var dmg = judged.damage || 0;
          if (dmg > 0) {
            p.hull = Math.max(0, p.hull - dmg);
            p.damageTaken += dmg;
          }
          events.push({ type: 'touchdown', grade: judged.grade, reason: judged.reason, damage: dmg });
          if (p.hull <= 0) events.push({ type: 'crash', reason: 'Airframe gave up' });
        }
      }
    }

    // --- position -------------------------------------------------------
    var fwd = { x: Math.sin(SC.rad(p.heading)), y: Math.cos(SC.rad(p.heading)) };
    var driftX = p.onGround ? 0 : wind.x;
    var driftY = p.onGround ? 0 : wind.y;
    p.x += (fwd.x * p.speed + driftX) * dt;
    p.y += (fwd.y * p.speed + driftY) * dt;
    // Keep the world bounded: turn-back hint beyond the island shelf.
    var rr = Math.sqrt(p.x * p.x + p.y * p.y);
    if (rr > 5200) { p.x *= 5200 / rr; p.y *= 5200 / rr; events.push({ type: 'edge' }); }

    return p;
  }

  SC.flight = {
    newPlane: newPlane,
    step: step,
    stallSpeed: stallSpeed,
    windAt: windAt,
    judgeTouchdown: judgeTouchdown,
    knots: function (ms) { return ms * 1.94384; },
    feet: function (m) { return m * 3.28084; }
  };
})();
