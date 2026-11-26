// World renderer: pseudo-3D projection on Canvas 2D.
// Sky, sea, island terrain, runway, rings, lighthouse, palms, volcano smoke,
// clouds and the Kestrel herself in chase view. All art is drawn in code.
(function () {
  'use strict';
  var SC = window.SC;
  var cfg = SC.config;
  var terrain = SC.terrain;

  var grid = terrain.buildGrid();
  var palms = terrain.buildPalms();
  var clouds = terrain.buildClouds();
  var summit = terrain.volcanoSummit();
  var lightBase = terrain.lighthouseBase();
  var smoke = [];
  var smokeTimer = 0;
  var burst = [];

  function focalFor(H, fovDeg) { return (H / 2) / Math.tan(SC.rad(fovDeg) / 2); }

  // Build camera basis vectors from heading/pitch/roll in degrees.
  function cameraBasis(cam) {
    var h = SC.rad(cam.heading), p = SC.rad(cam.pitch), r = SC.rad(cam.roll || 0);
    var f = { x: Math.sin(h) * Math.cos(p), y: Math.cos(h) * Math.cos(p), z: Math.sin(p) };
    var right0 = { x: Math.cos(h), y: -Math.sin(h), z: 0 };
    var up0 = {
      x: right0.y * f.z - right0.z * f.y,
      y: right0.z * f.x - right0.x * f.z,
      z: right0.x * f.y - right0.y * f.x
    };
    var cr = Math.cos(r), sr = Math.sin(r);
    var right = {
      x: right0.x * cr - up0.x * sr,
      y: right0.y * cr - up0.y * sr,
      z: right0.z * cr - up0.z * sr
    };
    var up = {
      x: right0.x * sr + up0.x * cr,
      y: right0.y * sr + up0.y * cr,
      z: right0.z * sr + up0.z * cr
    };
    return { f: f, right: right, up: up };
  }

  function project(cam, basis, focal, W, H, x, y, z) {
    var dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    var cz = dx * basis.f.x + dy * basis.f.y + dz * basis.f.z;
    var cx = dx * basis.right.x + dy * basis.right.y + dz * basis.right.z;
    var cy = dx * basis.up.x + dy * basis.up.y + dz * basis.up.z;
    return {
      sx: W / 2 + (cx / cz) * focal,
      sy: H / 2 - (cy / cz) * focal,
      cz: cz, cx: cx, cy: cy
    };
  }

  function poly(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // Deterministic per-quad brightness so the island reads as terrain,
  // not as a flat grid of identical tiles.
  function shadeColor(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    var g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    var b = Math.min(255, Math.round((n & 255) * f));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawSky(ctx, W, H, pal, cam, basis, focal, time) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(0.55, pal.skyMid);
    g.addColorStop(0.78, pal.skyLow);
    g.addColorStop(1, pal.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Sun: fixed direction, west-northwest, lower at dusk.
    var sunDir = pal.duskFactor
      ? { x: -0.75, y: 0.35, z: 0.16 }
      : { x: -0.45, y: 0.55, z: 0.62 };
    var sp = project(cam, basis, focal, W, H,
      cam.x + sunDir.x * 9000, cam.y + sunDir.y * 9000, cam.z + sunDir.z * 9000);
    if (sp.cz > 0) {
      var sr = pal.duskFactor ? 46 : 34;
      var glow = ctx.createRadialGradient(sp.sx, sp.sy, 2, sp.sx, sp.sy, sr * 4);
      glow.addColorStop(0, pal.sun);
      glow.addColorStop(0.25, pal.duskFactor ? 'rgba(255,170,90,0.45)' : 'rgba(255,243,196,0.4)');
      glow.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sp.sx, sp.sy, sr * 4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = pal.sun;
      ctx.beginPath(); ctx.arc(sp.sx, sp.sy, sr * 0.55, 0, 6.2832); ctx.fill();
    }
    // Clouds: a soft base with a brighter crown so they read as puffs.
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var cp = project(cam, basis, focal, W, H, c.x, c.y, c.z);
      if (cp.cz < 60 || cp.cz > 9000) continue;
      var wpx = (c.w / cp.cz) * focal;
      if (wpx < 6) continue;
      ctx.fillStyle = pal.cloud;
      ctx.beginPath();
      ctx.ellipse(cp.sx, cp.sy, wpx * 0.5, wpx * 0.14, 0, 0, 6.2832);
      ctx.ellipse(cp.sx - wpx * 0.26, cp.sy + wpx * 0.03, wpx * 0.3, wpx * 0.10, 0, 0, 6.2832);
      ctx.ellipse(cp.sx + wpx * 0.28, cp.sy + wpx * 0.02, wpx * 0.32, wpx * 0.11, 0, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = pal.duskFactor ? 'rgba(255,215,190,0.55)' : 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(cp.sx - wpx * 0.08, cp.sy - wpx * 0.06, wpx * 0.30, wpx * 0.10, 0, 0, 6.2832);
      ctx.fill();
    }
  }

  // Camera-space coordinates of a world point (before the perspective divide).
  function toCam(cam, basis, x, y, z) {
    var dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    return {
      cx: dx * basis.right.x + dy * basis.right.y + dz * basis.right.z,
      cy: dx * basis.up.x + dy * basis.up.y + dz * basis.up.z,
      cz: dx * basis.f.x + dy * basis.f.y + dz * basis.f.z
    };
  }

  // Clip a camera-space polygon against the near plane (cz >= near).
  function clipNear(polyPts, near) {
    var out = [];
    for (var i = 0; i < polyPts.length; i++) {
      var cur = polyPts[i], prev = polyPts[(i + polyPts.length - 1) % polyPts.length];
      var curIn = cur.cz >= near, prevIn = prev.cz >= near;
      if (curIn !== prevIn) {
        var t = (near - prev.cz) / (cur.cz - prev.cz);
        out.push({
          cx: prev.cx + (cur.cx - prev.cx) * t,
          cy: prev.cy + (cur.cy - prev.cy) * t,
          cz: near
        });
      }
      if (curIn) out.push(cur);
    }
    return out;
  }

  function drawSea(ctx, W, H, pal, cam, basis, focal) {
    var ext = 9000;
    var raw = [
      toCam(cam, basis, cam.x - ext, cam.y - ext, 0),
      toCam(cam, basis, cam.x + ext, cam.y - ext, 0),
      toCam(cam, basis, cam.x + ext, cam.y + ext, 0),
      toCam(cam, basis, cam.x - ext, cam.y + ext, 0)
    ];
    var clipped = clipNear(raw, cfg.camera.near);
    if (clipped.length < 3) return;
    var g = ctx.createLinearGradient(0, H * 0.45, 0, H);
    g.addColorStop(0, pal.seaFar);
    g.addColorStop(1, pal.sea);
    ctx.fillStyle = g;
    ctx.beginPath();
    clipped.forEach(function (c, i) {
      var sx = W / 2 + (c.cx / c.cz) * focal;
      var sy = H / 2 - (c.cy / c.cz) * focal;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fill();
  }

  function drawTerrain(ctx, W, H, pal, cam, basis, focal) {
    var n = grid.n, ext = grid.ext, cell = grid.cell, heights = grid.heights;
    var proj = new Array(n * n);
    var i, j;
    for (j = 0; j < n; j++) {
      for (i = 0; i < n; i++) {
        var x = -ext + i * cell, y = -ext + j * cell;
        var h = heights[j * n + i];
        proj[j * n + i] = project(cam, basis, focal, W, H, x, y, Math.max(h, 0));
      }
    }
    var quads = [];
    for (j = 0; j < n - 1; j++) {
      for (i = 0; i < n - 1; i++) {
        var a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        var hMax = Math.max(heights[a], heights[b], heights[c], heights[d]);
        if (hMax <= 0.25) continue;
        var pa = proj[a], pb = proj[b], pc = proj[c], pd = proj[d];
        var czAvg = (pa.cz + pb.cz + pc.cz + pd.cz) / 4;
        if (czAvg > 7500) continue;
        // Clip against the near plane so ground under the camera never
        // leaves a hole; fully-behind quads drop out here.
        var clipped = clipNear([pa, pb, pd, pc], cfg.camera.near);
        if (clipped.length < 3) continue;
        var pts = clipped.map(function (cp) {
          return { sx: W / 2 + (cp.cx / cp.cz) * focal, sy: H / 2 - (cp.cy / cp.cz) * focal };
        });
        // Screen-space cull.
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (var s = 0; s < pts.length; s++) {
          if (pts[s].sx < minX) minX = pts[s].sx;
          if (pts[s].sx > maxX) maxX = pts[s].sx;
          if (pts[s].sy < minY) minY = pts[s].sy;
          if (pts[s].sy > maxY) maxY = pts[s].sy;
        }
        if (maxX < -40 || minX > W + 40 || maxY < -40 || minY > H + 40) continue;
        var hAvg = (heights[a] + heights[b] + heights[c] + heights[d]) / 4;
        var slope = Math.abs(heights[b] - heights[a]) / cell + Math.abs(heights[c] - heights[a]) / cell;
        var hash = ((i * 73 + j * 149) % 9) / 9; // 0..1 stable per cell
        var baseCol = terrain.terrainColor(hAvg, slope, -ext + (i + 0.5) * cell, -ext + (j + 0.5) * cell, pal);
        quads.push({
          pts: pts, cz: czAvg,
          color: shadeColor(baseCol, 0.955 + hash * 0.09)
        });
      }
    }
    quads.sort(function (u, v) { return v.cz - u.cz; });
    for (var q = 0; q < quads.length; q++) poly(ctx, quads[q].pts, quads[q].color);
  }

  function runwayQuad(ctx, W, H, cam, basis, focal, along0, along1, across0, across1, fill) {
    var rw = cfg.runway;
    var raw = [
      toCam(cam, basis, rw.cx + along0, rw.cy + across0, rw.elev + 0.15),
      toCam(cam, basis, rw.cx + along1, rw.cy + across0, rw.elev + 0.15),
      toCam(cam, basis, rw.cx + along1, rw.cy + across1, rw.elev + 0.15),
      toCam(cam, basis, rw.cx + along0, rw.cy + across1, rw.elev + 0.15)
    ];
    var clipped = clipNear(raw, cfg.camera.near);
    if (clipped.length < 3) return;
    var pts = clipped.map(function (c) {
      return { sx: W / 2 + (c.cx / c.cz) * focal, sy: H / 2 - (c.cy / c.cz) * focal };
    });
    poly(ctx, pts, fill);
  }

  function drawRunway(ctx, W, H, pal, cam, basis, focal, plane, time) {
    var rw = cfg.runway;
    var half = rw.length / 2, hw = rw.width / 2;
    runwayQuad(ctx, W, H, cam, basis, focal, -half, half, -hw, hw, pal.asphalt);
    // Threshold "piano keys" at both ends.
    for (var e = 0; e < 2; e++) {
      var sgn = e === 0 ? -1 : 1;
      for (var k = 0; k < 8; k++) {
        var a0 = -hw + 3 + k * ((rw.width - 6) / 8);
        runwayQuad(ctx, W, H, cam, basis, focal,
          sgn * (half - 26), sgn * (half - 8), a0, a0 + 2.6, '#f4f6f8');
      }
      // Touchdown zone bars.
      for (var tz = 0; tz < 3; tz++) {
        var d0 = sgn * (half - 90 - tz * 70);
        runwayQuad(ctx, W, H, cam, basis, focal, d0, d0 - sgn * 22, -hw + 7, -hw + 10, '#e8ecf0');
        runwayQuad(ctx, W, H, cam, basis, focal, d0, d0 - sgn * 22, hw - 10, hw - 7, '#e8ecf0');
      }
    }
    // Centreline dashes.
    for (var d = -half + 40; d < half - 50; d += 34) {
      runwayQuad(ctx, W, H, cam, basis, focal, d, d + 16, -0.8, 0.8, '#f4f6f8');
    }
    // Edge lines.
    runwayQuad(ctx, W, H, cam, basis, focal, -half, half, -hw, -hw + 1.2, '#dfe5ea');
    runwayQuad(ctx, W, H, cam, basis, focal, -half, half, hw - 1.2, hw, '#dfe5ea');
    // Edge lights at dusk.
    if (pal.duskFactor) {
      for (var ld = -half; ld <= half; ld += 55) {
        [-hw - 2, hw + 2].forEach(function (across) {
          var lp = project(cam, basis, focal, W, H, rw.cx + ld, rw.cy + across, rw.elev + 1);
          if (lp.cz < 2) return;
          var r = Math.max(1.6, 60 / lp.cz);
          ctx.fillStyle = 'rgba(255,190,90,0.35)';
          ctx.beginPath(); ctx.arc(lp.sx, lp.sy, r * 2.6, 0, 6.2832); ctx.fill();
          ctx.fillStyle = '#ffd98a';
          ctx.beginPath(); ctx.arc(lp.sx, lp.sy, r, 0, 6.2832); ctx.fill();
        });
      }
    }
    // PAPI lights beside the west threshold: white = high, red = low.
    if (plane && !plane.onGround) {
      var dist = Math.max(1, Math.abs(plane.x - (rw.cx - half)));
      var ang = SC.deg(Math.atan2(plane.z - rw.elev, dist));
      var whites = SC.clamp(Math.round((ang - 2.2) / 0.45), 0, 4);
      for (var pi = 0; pi < 4; pi++) {
        var pp = project(cam, basis, focal, W, H, rw.cx - half + 18, rw.cy - hw - 8 - pi * 4, rw.elev + 1.2);
        if (pp.cz < 2) continue;
        var pr = Math.max(2, 90 / pp.cz);
        ctx.fillStyle = pi < whites ? '#ffffff' : '#ff4444';
        ctx.beginPath(); ctx.arc(pp.sx, pp.sy, pr, 0, 6.2832); ctx.fill();
      }
    }
  }

  function drawRing(ctx, W, H, cam, basis, focal, r, kind, time) {
    var c = project(cam, basis, focal, W, H, r.x, r.y, r.z);
    if (c.cz < 4) return;
    var rxv = { x: -r.ny, y: r.nx };
    var pL = project(cam, basis, focal, W, H, r.x - rxv.x * r.r, r.y - rxv.y * r.r, r.z);
    var pR = project(cam, basis, focal, W, H, r.x + rxv.x * r.r, r.y + rxv.y * r.r, r.z);
    var pT = project(cam, basis, focal, W, H, r.x, r.y, r.z + r.r);
    var pB = project(cam, basis, focal, W, H, r.x, r.y, r.z - r.r);
    var rx = Math.max(4, Math.hypot(pR.sx - pL.sx, pR.sy - pL.sy) / 2);
    var ry = Math.max(3, Math.hypot(pT.sx - pB.sx, pT.sy - pB.sy) / 2);
    var rot = Math.atan2(pR.sy - pL.sy, pR.sx - pL.sx);
    var col = kind === 'next' ? '#ffd23f' : kind === 'done' ? '#57e389' : '#37d5e8';
    var pulse = kind === 'next' ? 0.75 + 0.25 * Math.sin(time * 4) : 1;
    var lw = SC.clamp(900 / c.cz, 2, 14);
    ctx.save();
    ctx.globalAlpha = (kind === 'done' ? 0.35 : 0.16) * pulse;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(c.sx, c.sy, rx, ry, rot, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 0.45 * pulse;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * 2.4;
    ctx.beginPath(); ctx.ellipse(c.sx, c.sy, rx, ry, rot, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = pulse;
    ctx.lineWidth = lw;
    ctx.strokeStyle = kind === 'next' ? '#fff3b0' : col;
    ctx.beginPath(); ctx.ellipse(c.sx, c.sy, rx, ry, rot, 0, 6.2832); ctx.stroke();
    ctx.restore();
  }

  function drawLighthouse(ctx, W, H, pal, cam, basis, focal, time) {
    var b = lightBase;
    var base = project(cam, basis, focal, W, H, b.x, b.y, b.z);
    var top = project(cam, basis, focal, W, H, b.x, b.y, b.z + b.tower);
    if (base.cz < 5 || base.cz > 7000) return;
    var wBase = (7 / base.cz) * focal, wTop = (4.5 / top.cz) * focal;
    // Three painted bands.
    var bands = ['#f2f2f2', '#d8443c', '#f2f2f2'];
    for (var i = 0; i < 3; i++) {
      var t0 = i / 3, t1 = (i + 1) / 3;
      var y0 = SC.lerp(base.sy, top.sy, t0), y1 = SC.lerp(base.sy, top.sy, t1);
      var x0 = SC.lerp(base.sx, top.sx, t0), x1 = SC.lerp(base.sx, top.sx, t1);
      var w0 = SC.lerp(wBase, wTop, t0), w1 = SC.lerp(wBase, wTop, t1);
      ctx.fillStyle = bands[i];
      ctx.beginPath();
      ctx.moveTo(x0 - w0 / 2, y0); ctx.lineTo(x0 + w0 / 2, y0);
      ctx.lineTo(x1 + w1 / 2, y1); ctx.lineTo(x1 - w1 / 2, y1);
      ctx.closePath(); ctx.fill();
    }
    // Lamp room + rotating beam at dusk.
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(top.sx - wTop * 0.7, top.sy - wTop * 0.8, wTop * 1.4, wTop * 0.8);
    if (pal.duskFactor) {
      var ang = time * 0.7;
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.moveTo(top.sx, top.sy - wTop * 0.4);
      ctx.lineTo(top.sx + Math.cos(ang) * wBase * 14, top.sy - wTop * 0.4 + Math.sin(ang) * wBase * 3);
      ctx.lineTo(top.sx + Math.cos(ang + 0.22) * wBase * 14, top.sy - wTop * 0.4 + Math.sin(ang + 0.22) * wBase * 3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(top.sx, top.sy - wTop * 0.4, Math.max(2, wTop * 0.28), 0, 6.2832); ctx.fill();
  }

  function drawPalms(ctx, W, H, pal, cam, basis, focal) {
    ctx.strokeStyle = pal.duskFactor ? '#2c4a28' : '#2f6b2e';
    ctx.lineCap = 'round';
    for (var i = 0; i < palms.length; i++) {
      var t = palms[i];
      var base = project(cam, basis, focal, W, H, t.x, t.y, t.z);
      if (base.cz < 8 || base.cz > 1600) continue;
      var top = project(cam, basis, focal, W, H, t.x + t.lean * 3, t.y, t.z + t.size);
      var s = focal / base.cz;
      ctx.lineWidth = Math.max(1, 0.35 * s);
      ctx.beginPath(); ctx.moveTo(base.sx, base.sy); ctx.lineTo(top.sx, top.sy); ctx.stroke();
      ctx.lineWidth = Math.max(1, 0.22 * s);
      for (var f = 0; f < 5; f++) {
        var a = (f / 5) * 6.2832 + t.lean * 4;
        ctx.beginPath();
        ctx.moveTo(top.sx, top.sy);
        ctx.quadraticCurveTo(
          top.sx + Math.cos(a) * 2.2 * s, top.sy - 0.8 * s,
          top.sx + Math.cos(a) * 3.4 * s, top.sy + 0.7 * s);
        ctx.stroke();
      }
    }
  }

  function updateSmoke(dt, frozen) {
    if (frozen) {
      if (smoke.length === 0) {
        var rng = SC.makeRng(4242);
        for (var i = 0; i < 22; i++) {
          smoke.push({
            x: summit.x + rng() * 30 - 15, y: summit.y + rng() * 30 - 15,
            z: summit.z + 8 + rng() * 130, age: rng() * 5, life: 6,
            r: 16 + rng() * 46
          });
        }
      }
      return;
    }
    smokeTimer -= dt;
    if (smokeTimer <= 0) {
      smokeTimer = 0.14;
      smoke.push({
        x: summit.x + (Math.random() * 24 - 12), y: summit.y + (Math.random() * 24 - 12),
        z: summit.z + 10, age: 0, life: 5 + Math.random() * 2, r: 12
      });
    }
    for (var j = smoke.length - 1; j >= 0; j--) {
      var s = smoke[j];
      s.age += dt;
      s.z += 7 * dt; s.x += 2.2 * dt; s.y += 1.1 * dt; s.r += 6 * dt;
      if (s.age > s.life) smoke.splice(j, 1);
    }
  }

  function drawSmoke(ctx, W, H, pal, cam, basis, focal) {
    var sorted = smoke.slice().sort(function (a, b) {
      var da = (a.x - cam.x) * (a.x - cam.x) + (a.y - cam.y) * (a.y - cam.y);
      var db = (b.x - cam.x) * (b.x - cam.x) + (b.y - cam.y) * (b.y - cam.y);
      return db - da;
    });
    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i];
      var p = project(cam, basis, focal, W, H, s.x, s.y, s.z);
      if (p.cz < 5) continue;
      var r = (s.r / p.cz) * focal;
      var a = 0.34 * (1 - s.age / s.life);
      ctx.fillStyle = pal.duskFactor ? 'rgba(90,80,95,' + a + ')' : 'rgba(120,120,125,' + a + ')';
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, 6.2832); ctx.fill();
    }
  }

  function spawnExplosion(x, y, z) {
    burst = [];
    for (var i = 0; i < 46; i++) {
      var a = Math.random() * 6.2832, sp = 4 + Math.random() * 22;
      burst.push({
        x: x, y: y, z: z + 1,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 4 + Math.random() * 16,
        age: 0, life: 1 + Math.random() * 1.6, r: 2 + Math.random() * 5
      });
    }
  }

  function drawExplosion(ctx, W, H, cam, basis, focal, dt, frozen) {
    for (var i = burst.length - 1; i >= 0; i--) {
      var b = burst[i];
      if (!frozen) {
        b.age += dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        b.vz -= 14 * dt;
        if (b.age > b.life) { burst.splice(i, 1); continue; }
      }
      var p = project(cam, basis, focal, W, H, b.x, b.y, b.z);
      if (p.cz < 2) continue;
      var r = Math.max(2, (b.r / p.cz) * focal);
      var t = b.age / b.life;
      ctx.fillStyle = t < 0.35 ? 'rgba(255,190,60,0.9)' : t < 0.7 ? 'rgba(240,100,40,0.75)' : 'rgba(70,70,75,0.6)';
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r * (1 + t), 0, 6.2832); ctx.fill();
    }
  }

  // The Kestrel from behind: mail-plane cream and orange, banking with roll.
  function drawAircraft(ctx, W, H, cam, basis, focal, plane, pal, time) {
    // Ground shadow first.
    var gz = terrain.surfaceHeight(plane.x, plane.y);
    var sh = project(cam, basis, focal, W, H, plane.x, plane.y, gz + 0.3);
    var pp = project(cam, basis, focal, W, H, plane.x, plane.y, plane.z);
    if (pp.cz < 2) return;
    if (sh.cz > 2) {
      var agl = Math.max(0, plane.z - gz);
      var shr = Math.max(3, ((5.5 + agl * 0.05) / sh.cz) * focal);
      var shAlpha = SC.clamp(0.38 - agl * 0.0035, 0.06, 0.38);
      ctx.fillStyle = 'rgba(10,20,15,' + shAlpha.toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(sh.sx, sh.sy, shr, shr * 0.32, 0, 0, 6.2832); ctx.fill();
    }
    var s = focal / pp.cz; // pixels per metre at the plane
    ctx.save();
    ctx.translate(pp.sx, pp.sy);
    ctx.rotate(SC.rad(plane.roll * 0.9));
    var pitchSquash = 1 - Math.abs(Math.sin(SC.rad(plane.pitch))) * 0.25;
    ctx.scale(1, pitchSquash);
    var wing = 11 * s, bodyL = 8.6 * s;
    // Main wing (behind fuselage), orange tips.
    ctx.fillStyle = '#e8e2d2';
    ctx.beginPath();
    ctx.moveTo(-wing / 2, bodyL * 0.06); ctx.lineTo(-wing * 0.06, -bodyL * 0.10);
    ctx.lineTo(wing * 0.06, -bodyL * 0.10); ctx.lineTo(wing / 2, bodyL * 0.06);
    ctx.lineTo(wing / 2, bodyL * 0.16); ctx.lineTo(-wing / 2, bodyL * 0.16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8722a';
    ctx.fillRect(-wing / 2, bodyL * 0.06, wing * 0.09, bodyL * 0.10);
    ctx.fillRect(wing / 2 - wing * 0.09, bodyL * 0.06, wing * 0.09, bodyL * 0.10);
    // Fuselage: nose up-screen, tail toward camera (down-screen).
    var fg = ctx.createLinearGradient(0, -bodyL / 2, 0, bodyL / 2);
    fg.addColorStop(0, '#f4efe0'); fg.addColorStop(1, '#cfc6ae');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(0, 0, wing * 0.085, bodyL * 0.52, 0, 0, 6.2832);
    ctx.fill();
    // Orange cheatline.
    ctx.fillStyle = '#e8722a';
    ctx.fillRect(-wing * 0.085, -bodyL * 0.05, wing * 0.17, bodyL * 0.07);
    // Canopy.
    ctx.fillStyle = '#22384f';
    ctx.beginPath();
    ctx.ellipse(0, -bodyL * 0.14, wing * 0.055, bodyL * 0.15, 0, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,240,0.5)';
    ctx.beginPath();
    ctx.ellipse(-wing * 0.02, -bodyL * 0.18, wing * 0.02, bodyL * 0.06, -0.4, 0, 6.2832);
    ctx.fill();
    // Tailplane + fin at the near (bottom) end.
    ctx.fillStyle = '#e8e2d2';
    ctx.beginPath();
    ctx.moveTo(-wing * 0.20, bodyL * 0.40); ctx.lineTo(wing * 0.20, bodyL * 0.40);
    ctx.lineTo(wing * 0.16, bodyL * 0.50); ctx.lineTo(-wing * 0.16, bodyL * 0.50);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8722a';
    ctx.beginPath();
    ctx.moveTo(-wing * 0.016, bodyL * 0.30); ctx.lineTo(wing * 0.016, bodyL * 0.30);
    ctx.lineTo(wing * 0.012, bodyL * 0.52); ctx.lineTo(-wing * 0.012, bodyL * 0.52);
    ctx.closePath(); ctx.fill();
    // Prop disc at the nose.
    ctx.fillStyle = 'rgba(40,40,45,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, -bodyL * 0.52, wing * 0.16, bodyL * 0.035, 0, 0, 6.2832);
    ctx.fill();
    // Gear legs when down.
    if (plane.gearDown) {
      ctx.strokeStyle = '#3a3f46';
      ctx.lineWidth = Math.max(1.5, 0.16 * s);
      ctx.beginPath();
      ctx.moveTo(-wing * 0.07, bodyL * 0.10); ctx.lineTo(-wing * 0.10, bodyL * 0.30);
      ctx.moveTo(wing * 0.07, bodyL * 0.10); ctx.lineTo(wing * 0.10, bodyL * 0.30);
      ctx.stroke();
      ctx.fillStyle = '#22252a';
      ctx.beginPath(); ctx.arc(-wing * 0.10, bodyL * 0.32, 0.32 * s, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(wing * 0.10, bodyL * 0.32, 0.32 * s, 0, 6.2832); ctx.fill();
    }
    // Dusk beacon + nav lights.
    if (pal.duskFactor) {
      if (Math.sin(time * 6) > 0) {
        ctx.fillStyle = '#ff5544';
        ctx.beginPath(); ctx.arc(0, bodyL * 0.22, Math.max(2, 0.18 * s), 0, 6.2832); ctx.fill();
      }
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(-wing / 2, bodyL * 0.11, Math.max(2, 0.14 * s), 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#44ff77';
      ctx.beginPath(); ctx.arc(wing / 2, bodyL * 0.11, Math.max(2, 0.14 * s), 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  function drawScene(ctx, W, H, state) {
    var cam = state.camera;
    var pal = state.pal;
    var focal = focalFor(H, state.fov || cfg.camera.fovDeg);
    var basis = cameraBasis(cam);
    drawSky(ctx, W, H, pal, cam, basis, focal, state.time);
    drawSea(ctx, W, H, pal, cam, basis, focal);
    drawTerrain(ctx, W, H, pal, cam, basis, focal);
    drawRunway(ctx, W, H, pal, cam, basis, focal, state.plane, state.time);
    drawPalms(ctx, W, H, pal, cam, basis, focal);
    drawLighthouse(ctx, W, H, pal, cam, basis, focal, state.time);
    updateSmoke(state.dt, state.frozen);
    drawSmoke(ctx, W, H, pal, cam, basis, focal);
    // Rings far-to-near.
    if (state.sortie) {
      var rings = state.sortie.rings.slice();
      rings.sort(function (a, b) {
        var da = (a.x - cam.x) * (a.x - cam.x) + (a.y - cam.y) * (a.y - cam.y);
        var db = (b.x - cam.x) * (b.x - cam.x) + (b.y - cam.y) * (b.y - cam.y);
        return db - da;
      });
      var next = SC.missions.nextRing(state.sortie);
      for (var i = 0; i < rings.length; i++) {
        var kind = rings[i].passed ? 'done' : (rings[i] === next ? 'next' : 'todo');
        drawRing(ctx, W, H, cam, basis, focal, rings[i], kind, state.time);
      }
    }
    if (state.view === 'chase' || state.view === 'title') {
      drawAircraft(ctx, W, H, cam, basis, focal, state.plane, pal, state.time);
    }
    drawExplosion(ctx, W, H, cam, basis, focal, state.dt, state.frozen);
    return { basis: basis, focal: focal };
  }

  SC.world = {
    drawScene: drawScene,
    project: project,
    cameraBasis: cameraBasis,
    focalFor: focalFor,
    spawnExplosion: spawnExplosion
  };
})();
