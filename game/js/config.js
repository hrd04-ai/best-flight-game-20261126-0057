// Sky Courier — Island Rings: shared configuration.
// World layout numbers, flight constants, palettes for day and dusk.
// Everything in this game is original: names, art and sounds are made here.
(function () {
  'use strict';
  var SC = (window.SC = window.SC || {});

  SC.config = {
    // Island layout, metres. Heading 0 = north (+Y), 90 = east (+X).
    island: {
      extent: 3400,          // terrain grid half-size
      cell: 90,              // terrain quad size
      volcano: { x: -950, y: 950, height: 430, radius: 920 },
      lighthouse: { x: 1550, y: -520, tower: 30 },
      hills: [
        { x: 700, y: 800, h: 120, r: 800 },
        { x: -300, y: -200, h: 70, r: 700 },
        { x: 1200, y: 300, h: 90, r: 650 },
        { x: -1500, y: -700, h: 80, r: 700 },
        { x: 300, y: 1500, h: 100, r: 750 },
        { x: 1800, y: -1300, h: 60, r: 600 }
      ]
    },
    // Runway 09/27: along the X axis on the island's south flat.
    runway: {
      cx: 0, cy: -1500, length: 950, width: 46, elev: 8, heading: 90
    },
    // The mail plane "Kestrel": simple, forgiving, honest numbers.
    plane: {
      maxSpeed: 88,          // m/s, ~171 kt
      stallClean: 23,        // m/s, ~45 kt
      stallFlaps: 19,        // m/s, ~37 kt
      rotateSpeed: 27,       // m/s, ~52 kt
      gearHeight: 1.3,       // metres above ground when rolling
      maxPitch: 32,          // degrees
      maxRoll: 58,           // degrees
      fuelBurn: 0.30,        // %/s at full throttle
      ringRadius: 27         // metres
    },
    camera: {
      fovDeg: 64,
      chaseBack: 24,         // metres behind the plane
      chaseUp: 6.5,          // metres above the plane
      near: 2.5
    },
    palettes: {
      day: {
        skyTop: '#2e6fc4', skyMid: '#7db3e8', skyLow: '#cfe8f7',
        sea: '#1d6fa8', seaFar: '#3f8fc4',
        sand: '#e8d9a0', grass: '#5da24e', grassDry: '#8fae57',
        forest: '#3d7d3c', rock: '#8d8578', volcano: '#6f6a63',
        crater: '#4c4742', asphalt: '#4a4d52', sun: '#fff3c4',
        cloud: 'rgba(255,255,255,0.85)', duskFactor: 0
      },
      dusk: {
        skyTop: '#2b2a55', skyMid: '#8a4a72', skyLow: '#f2a65e',
        sea: '#274b73', seaFar: '#4a5f8a',
        sand: '#c9a86f', grass: '#4a7040', grassDry: '#6f7f47',
        forest: '#33542f', rock: '#6e675e', volcano: '#57534e',
        crater: '#3a3633', asphalt: '#3c3f45', sun: '#ffb36b',
        cloud: 'rgba(240,180,150,0.7)', duskFactor: 1
      }
    }
  };

  // Deterministic RNG (mulberry32) so scenery and screenshot staging are stable.
  SC.makeRng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  SC.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  SC.lerp = function (a, b, t) { return a + (b - a) * t; };
  SC.deg = function (rad) { return rad * 180 / Math.PI; };
  SC.rad = function (deg) { return deg * Math.PI / 180; };
  // Shortest signed angle difference a-b in degrees, in (-180, 180].
  SC.angleDiff = function (a, b) {
    var d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
  };
  SC.wrap360 = function (a) { a %= 360; return a < 0 ? a + 360 : a; };
})();
