// Missions: the three sorties, their ring routes, scoring and debrief maths.
// Rings are flown in order; the gold ring is always the next one.
(function () {
  'use strict';
  var SC = window.SC;
  var cfg = SC.config;

  function ring(x, y, z, nx, ny) {
    var len = Math.sqrt(nx * nx + ny * ny) || 1;
    return { x: x, y: y, z: z, nx: nx / len, ny: ny / len, r: cfg.plane.ringRadius, passed: false, side: 0 };
  }

  var SORTIES = [
    {
      id: 1, name: 'First Post', dusk: false, fuel: 100, parTime: 240,
      wind: null,
      brief: 'Take off, thread 5 rings over the bay, land back on runway 09/27.',
      rings: [
        ring(650, -1350, 130, 1, 0.25),
        ring(1350, -800, 170, 0.8, 0.6),
        ring(1500, 150, 210, 0.1, 1),
        ring(800, 800, 240, -0.6, 0.8),
        ring(-100, 350, 190, -0.8, -0.4)
      ]
    },
    {
      id: 2, name: 'Volcano Run', dusk: false, fuel: 100, parTime: 330,
      wind: { base: 4.5, gust: 4.0, fromDeg: 240 },
      brief: '7 rings: climb over the volcano ridge, skim the lighthouse, mind the gusts.',
      rings: [
        ring(700, -1200, 160, 1, 0.3),
        ring(1450, -500, 95, 0.5, 0.85),
        ring(1250, 500, 260, -0.3, 0.95),
        ring(250, 1150, 430, -0.85, 0.5),
        ring(-950, 980, 540, -0.4, -0.9),
        ring(-1600, 150, 320, 0.2, -0.98),
        ring(-900, -700, 210, 0.75, -0.65)
      ]
    },
    {
      id: 3, name: 'Dusk Delivery', dusk: true, fuel: 58, parTime: 360,
      wind: { base: 3.0, gust: 2.5, fromDeg: 120 },
      brief: '8 rings at dusk on tight fuel. Runway lights are on — bring her home.',
      rings: [
        ring(600, -1100, 140, 1, 0.35),
        ring(1300, -350, 180, 0.6, 0.8),
        ring(1550, 450, 230, -0.1, 1),
        ring(900, 1150, 300, -0.7, 0.7),
        ring(0, 1450, 340, -1, 0.1),
        ring(-900, 1050, 470, -0.5, -0.85),
        ring(-1550, 250, 280, 0.15, -0.99),
        ring(-850, -650, 190, 0.8, -0.6)
      ]
    }
  ];

  function cloneSortie(def) {
    var s = {
      id: def.id, name: def.name, dusk: def.dusk, fuel: def.fuel,
      parTime: def.parTime, wind: def.wind, brief: def.brief,
      rings: def.rings.map(function (r) {
        return { x: r.x, y: r.y, z: r.z, nx: r.nx, ny: r.ny, r: r.r, passed: false, side: 0 };
      }),
      ringsDone: 0, startedAt: 0, elapsed: 0
    };
    return s;
  }

  function nextRing(sortie) {
    for (var i = 0; i < sortie.rings.length; i++) {
      if (!sortie.rings[i].passed) return sortie.rings[i];
    }
    return null;
  }

  // Detect crossing the next ring's plane inside its radius (forgiving:
  // passing within 90% of the radius of the centre also counts).
  function checkRingPass(sortie, p) {
    var r = nextRing(sortie);
    if (!r || p.onGround) return null;
    var dx = p.x - r.x, dy = p.y - r.y, dz = p.z - r.z;
    var along = dx * r.nx + dy * r.ny;
    var side = along >= 0 ? 1 : -1;
    var radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var crossed = r.side !== 0 && side !== r.side && radial <= r.r;
    var through = dist <= r.r * 0.9;
    r.side = side;
    if (crossed || through) {
      r.passed = true;
      sortie.ringsDone++;
      return r;
    }
    return null;
  }

  function scoreSortie(sortie, p) {
    var ringPts = sortie.ringsDone * 150;
    var grade = p.lastTouchdown ? p.lastTouchdown.grade : null;
    var landingPts = grade === 'GREASED' ? 400 : grade === 'FIRM' ? 250 : grade === 'HARD' ? 100 : 0;
    var timeBonus = Math.max(0, Math.round((sortie.parTime - sortie.elapsed) * 2));
    var damagePenalty = p.damageTaken * 3;
    var total = Math.max(0, ringPts + landingPts + timeBonus - damagePenalty);
    var maxScore = sortie.rings.length * 150 + 400 + sortie.parTime;
    var stars = total >= maxScore * 0.62 ? 3 : total >= maxScore * 0.4 ? 2 : total > 0 ? 1 : 0;
    return {
      ringPts: ringPts, landingPts: landingPts, timeBonus: timeBonus,
      damagePenalty: damagePenalty, total: total, stars: stars, grade: grade
    };
  }

  function objectiveText(sortie, p) {
    var r = nextRing(sortie);
    if (p.onGround && sortie.ringsDone === 0 && p.speed < 1) {
      return 'Throttle up (Shift) — rotate at 55 kt';
    }
    if (r) {
      var d = Math.round(Math.sqrt((p.x - r.x) * (p.x - r.x) + (p.y - r.y) * (p.y - r.y) + (p.z - r.z) * (p.z - r.z)));
      return 'Ring ' + (sortie.ringsDone + 1) + '/' + sortie.rings.length + ' — ' + d + ' m';
    }
    if (p.onGround) return 'All rings done — stop on the runway';
    return 'All rings done — land on runway 09/27';
  }

  SC.missions = {
    SORTIES: SORTIES,
    cloneSortie: cloneSortie,
    nextRing: nextRing,
    checkRingPass: checkRingPass,
    scoreSortie: scoreSortie,
    objectiveText: objectiveText
  };
})();
