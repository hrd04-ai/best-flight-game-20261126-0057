// Terrain: the island heightfield, runway geometry and scenery anchors.
// Heights are metres above sea level; anything at or below 0 is water.
(function () {
  'use strict';
  var SC = window.SC;
  var cfg = SC.config;

  function gauss(x, y, cx, cy, r) {
    var dx = x - cx, dy = y - cy;
    return Math.exp(-(dx * dx + dy * dy) / (r * r));
  }

  // Raw island shape before the runway flat is blended in.
  function islandHeight(x, y) {
    var r = Math.sqrt(x * x + y * y);
    var h = 58 * Math.exp(-(r * r) / (2350 * 2350)) - 14;
    var hills = cfg.island.hills;
    for (var i = 0; i < hills.length; i++) {
      h += hills[i].h * gauss(x, y, hills[i].x, hills[i].y, hills[i].r);
    }
    var v = cfg.island.volcano;
    var dv = Math.sqrt((x - v.x) * (x - v.x) + (y - v.y) * (y - v.y));
    if (dv < v.radius) {
      var cone = v.height * Math.pow(1 - dv / v.radius, 1.25);
      // Crater bowl near the summit.
      cone -= 46 * gauss(x, y, v.x, v.y, 130);
      if (cone > h) h = cone;
    }
    return h;
  }

  // Distance outside the runway rectangle (0 when inside), for flattening.
  function runwayOutside(x, y) {
    var rw = cfg.runway;
    var dx = Math.abs(x - rw.cx) - rw.length / 2;
    var dy = Math.abs(y - rw.cy) - rw.width / 2;
    var ox = Math.max(dx, 0), oy = Math.max(dy, 0);
    return Math.sqrt(ox * ox + oy * oy);
  }

  function groundHeight(x, y) {
    var h = islandHeight(x, y);
    var out = runwayOutside(x, y);
    if (out < 170) {
      var t = SC.clamp(out / 170, 0, 1);
      t = t * t * (3 - 2 * t);
      h = SC.lerp(cfg.runway.elev, h, t);
    }
    return h;
  }

  // Surface height the plane rests on: water surface counts as 0.
  function surfaceHeight(x, y) {
    var h = groundHeight(x, y);
    return h > 0 ? h : 0;
  }

  function isWater(x, y) { return groundHeight(x, y) <= 0.4; }

  function onRunway(x, y, margin) {
    var rw = cfg.runway;
    return Math.abs(x - rw.cx) <= rw.length / 2 + (margin || 0) &&
           Math.abs(y - rw.cy) <= rw.width / 2 + (margin || 0);
  }

  // Slope magnitude (rise over run) from finite differences.
  function slopeAt(x, y) {
    var e = 12;
    var gx = (groundHeight(x + e, y) - groundHeight(x - e, y)) / (2 * e);
    var gy = (groundHeight(x, y + e) - groundHeight(x, y - e)) / (2 * e);
    return Math.sqrt(gx * gx + gy * gy);
  }

  // Colour of a terrain quad from its height, slope and volcano proximity.
  function terrainColor(h, slope, x, y, pal) {
    if (h <= 0.4) return pal.sea;
    if (h < 3.2) return pal.sand;
    var v = cfg.island.volcano;
    var dv = Math.sqrt((x - v.x) * (x - v.x) + (y - v.y) * (y - v.y));
    if (dv < v.radius * 0.62) {
      return h > v.height - 70 ? pal.crater : pal.volcano;
    }
    if (slope > 0.55 || h > 210) return pal.rock;
    if (h > 95) return pal.grassDry;
    if (h > 38) return pal.forest;
    return pal.grass;
  }

  // Precomputed grid of corner heights for the renderer.
  var grid = null;
  function buildGrid() {
    var ext = cfg.island.extent, cell = cfg.island.cell;
    var n = Math.floor((ext * 2) / cell) + 1;
    var heights = new Float32Array(n * n);
    for (var j = 0; j < n; j++) {
      for (var i = 0; i < n; i++) {
        heights[j * n + i] = groundHeight(-ext + i * cell, -ext + j * cell);
      }
    }
    grid = { n: n, ext: ext, cell: cell, heights: heights };
    return grid;
  }

  // Palm trees: fixed seeded spots on low, gentle grass away from the runway.
  function buildPalms() {
    var rng = SC.makeRng(20261126);
    var palms = [];
    var tries = 0;
    while (palms.length < 170 && tries < 4000) {
      tries++;
      var x = (rng() * 2 - 1) * 2900;
      var y = (rng() * 2 - 1) * 2900;
      var h = groundHeight(x, y);
      if (h < 2.5 || h > 42) continue;
      if (onRunway(x, y, 90)) continue;
      if (slopeAt(x, y) > 0.3) continue;
      palms.push({ x: x, y: y, z: h, lean: rng() * 0.5 - 0.25, size: 7 + rng() * 4 });
    }
    return palms;
  }

  // Clouds: soft billboards drifting slowly east.
  function buildClouds() {
    var rng = SC.makeRng(777);
    var clouds = [];
    for (var i = 0; i < 26; i++) {
      clouds.push({
        x: (rng() * 2 - 1) * 4200,
        y: (rng() * 2 - 1) * 4200,
        z: 620 + rng() * 420,
        w: 380 + rng() * 520,
        drift: 3 + rng() * 4
      });
    }
    return clouds;
  }

  SC.terrain = {
    groundHeight: groundHeight,
    surfaceHeight: surfaceHeight,
    isWater: isWater,
    onRunway: onRunway,
    slopeAt: slopeAt,
    terrainColor: terrainColor,
    buildGrid: buildGrid,
    buildPalms: buildPalms,
    buildClouds: buildClouds,
    volcanoSummit: function () {
      var v = cfg.island.volcano;
      return { x: v.x, y: v.y, z: groundHeight(v.x, v.y) };
    },
    lighthouseBase: function () {
      var l = cfg.island.lighthouse;
      return { x: l.x, y: l.y, z: groundHeight(l.x, l.y), tower: l.tower };
    }
  };
})();
