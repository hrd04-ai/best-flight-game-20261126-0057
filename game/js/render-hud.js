// HUD: big readable ALT / SPD / HDG tapes, compass ribbon, bars, warnings,
// mission objective and the off-screen ring pointer. Built to stay legible
// when the screenshot is shrunk to a thumbnail.
(function () {
  'use strict';
  var SC = window.SC;
  var flight = SC.flight;

  function panel(ctx, x, y, w, h, alpha) {
    ctx.fillStyle = 'rgba(8,18,28,' + (alpha || 0.55) + ')';
    ctx.strokeStyle = 'rgba(140,220,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill(); ctx.stroke();
  }

  function speedTape(ctx, W, H, p) {
    var kt = flight.knots(p.speed);
    var x = 18, y = H * 0.30, w = 104, h = H * 0.34;
    panel(ctx, x, y, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = '#bfe9ff';
    ctx.textAlign = 'left';
    var pxPerKt = h / 90;
    for (var v = Math.floor((kt - 50) / 10) * 10; v < kt + 50; v += 10) {
      if (v < 0) continue;
      var yy = y + h / 2 + (kt - v) * pxPerKt;
      ctx.fillRect(x + w - 22, yy, 12, 1.6);
      ctx.fillText(String(v), x + 10, yy + 4);
    }
    // Stall band.
    var stallKt = flight.knots(SC.flight.stallSpeed(p));
    var sy = y + h / 2 + (kt - stallKt) * pxPerKt;
    ctx.fillStyle = 'rgba(255,70,60,0.5)';
    ctx.fillRect(x + w - 10, sy, 10, h);
    ctx.restore();
    // Big digital readout.
    ctx.fillStyle = '#0b2233';
    ctx.fillRect(x + 6, y + h / 2 - 22, w - 12, 44);
    ctx.strokeStyle = '#7fd4ff'; ctx.strokeRect(x + 6, y + h / 2 - 22, w - 12, 44);
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(kt)), x + w / 2, y + h / 2 + 11);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = '#8fd0f5';
    ctx.fillText('KT', x + w / 2, y + 16);
  }

  function altitudeTape(ctx, W, H, p) {
    var ft = flight.feet(p.z);
    var w = 116, x = W - w - 18, y = H * 0.30, h = H * 0.34;
    panel(ctx, x, y, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = '#bfe9ff';
    ctx.textAlign = 'right';
    var pxPerFt = h / 900;
    for (var v = Math.floor((ft - 500) / 100) * 100; v < ft + 500; v += 100) {
      if (v < 0) continue;
      var yy = y + h / 2 + (ft - v) * pxPerFt;
      ctx.fillRect(x + 10, yy, 12, 1.6);
      ctx.fillText(String(v), x + w - 10, yy + 4);
    }
    ctx.restore();
    ctx.fillStyle = '#0b2233';
    ctx.fillRect(x + 6, y + h / 2 - 22, w - 12, 44);
    ctx.strokeStyle = '#7fd4ff'; ctx.strokeRect(x + 6, y + h / 2 - 22, w - 12, 44);
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '800 27px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(ft)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), x + w / 2, y + h / 2 + 10);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = '#8fd0f5';
    ctx.fillText('FT', x + w / 2, y + 16);
    // Vertical speed readout under the tape.
    var fpm = Math.round(p.vspeed * 196.85);
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = fpm < -600 ? '#ffb0a0' : '#bfe9ff';
    ctx.fillText((fpm >= 0 ? '+' : '') + fpm + ' fpm', x + w / 2, y + h + 22);
  }

  function compassRibbon(ctx, W, H, p) {
    var w = Math.min(460, W * 0.42), x = W / 2 - w / 2, y = 14, h = 44;
    panel(ctx, x, y, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    var pxPerDeg = w / 90;
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (var d = Math.floor((p.heading - 50) / 5) * 5; d < p.heading + 50; d += 5) {
      var dd = SC.wrap360(d);
      var xx = W / 2 + SC.angleDiff(dd, p.heading) * pxPerDeg;
      var major = dd % 30 === 0;
      ctx.fillStyle = major ? '#eaf7ff' : '#7fb8d8';
      ctx.fillRect(xx, y + h - (major ? 14 : 8), 1.6, major ? 14 : 8);
      if (major) {
        var label = dd === 0 ? 'N' : dd === 90 ? 'E' : dd === 180 ? 'S' : dd === 270 ? 'W' : String(dd / 10).padStart(2, '0');
        ctx.fillText(label, xx, y + 19);
      }
    }
    ctx.restore();
    // Heading bug + digital.
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 7, y + h + 2); ctx.lineTo(W / 2 + 7, y + h + 2); ctx.lineTo(W / 2, y + h - 7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0b2233';
    ctx.fillRect(W / 2 - 34, y + h + 6, 68, 26);
    ctx.strokeStyle = '#7fd4ff'; ctx.strokeRect(W / 2 - 34, y + h + 6, 68, 26);
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(SC.wrap360(p.heading))).padStart(3, '0') + '°', W / 2, y + h + 25);
  }

  function bars(ctx, W, H, p) {
    var x = 18, y = H - 118, w = 190;
    panel(ctx, x, y, w, 100);
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    function bar(label, val, color, yy) {
      ctx.fillStyle = '#bfe9ff';
      ctx.fillText(label, x + 12, yy + 11);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + 58, yy, w - 70, 12);
      ctx.fillStyle = color;
      ctx.fillRect(x + 58, yy, (w - 70) * SC.clamp(val, 0, 1), 12);
    }
    bar('THR', p.throttle, '#7fd4ff', y + 12);
    bar('FUEL', p.fuel / 100, p.fuel < 20 ? '#ff6b5e' : '#ffd23f', y + 38);
    bar('HULL', p.hull / 100, p.hull < 35 ? '#ff6b5e' : '#57e389', y + 64);
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(p.gearDown ? 'GEAR ▼' : 'GEAR ▲', x + 12, y + 95);
    ctx.fillStyle = p.flaps ? '#ffd23f' : '#6f93ad';
    ctx.fillText(p.flaps ? 'FLAPS ▼' : 'FLAPS ▲', x + 100, y + 95);
  }

  function missionBox(ctx, W, H, sortie, p, score, topRight) {
    var w = 300, x = W - w - 18, y = topRight ? 96 : H - 118;
    panel(ctx, x, y, w, 100);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillText('SORTIE ' + sortie.id + ' — ' + sortie.name.toUpperCase(), x + 12, y + 24);
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(SC.missions.objectiveText(sortie, p), x + 12, y + 46);
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = '#bfe9ff';
    var mm = Math.floor(sortie.elapsed / 60), ss = Math.floor(sortie.elapsed % 60);
    ctx.fillText('RINGS ' + sortie.ringsDone + '/' + sortie.rings.length +
      '    TIME ' + mm + ':' + String(ss).padStart(2, '0') +
      '    SCORE ' + score, x + 12, y + 70);
    // Ring pips.
    for (var i = 0; i < sortie.rings.length; i++) {
      var px = x + 14 + i * 20, py = y + 86;
      ctx.fillStyle = sortie.rings[i].passed ? '#57e389' : (i === sortie.ringsDone ? '#ffd23f' : 'rgba(255,255,255,0.25)');
      ctx.beginPath(); ctx.arc(px, py, 6, 0, 6.2832); ctx.fill();
    }
  }

  function reticle(ctx, W, H, p) {
    var cx = W / 2, cy = H / 2;
    ctx.strokeStyle = 'rgba(160,230,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 6.2832); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 16, cy);
    ctx.moveTo(cx + 16, cy); ctx.lineTo(cx + 26, cy);
    ctx.moveTo(cx, cy - 26); ctx.lineTo(cx, cy - 16);
    ctx.stroke();
    // Flight-path marker: where the plane is actually going.
    var fpmY = cy - SC.clamp(p.vspeed * 6, -60, 60) + SC.clamp(p.pitch, -20, 20) * 2.2;
    ctx.strokeStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(cx, fpmY, 7, 0, 6.2832); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 16, fpmY); ctx.lineTo(cx - 8, fpmY);
    ctx.moveTo(cx + 8, fpmY); ctx.lineTo(cx + 16, fpmY);
    ctx.stroke();
  }

  function warnings(ctx, W, H, p, sortie, time) {
    var msgs = [];
    if (p.stalled) msgs.push({ t: 'STALL — NOSE DOWN, ADD POWER', c: '#ff5544' });
    var agl = p.z - SC.terrain.surfaceHeight(p.x, p.y);
    if (!p.onGround && agl < 55 && !p.gearDown && p.vspeed < -1) msgs.push({ t: 'GEAR UP — PRESS G', c: '#ffb02e' });
    if (!p.onGround && agl < 40 && p.vspeed < -4 && !SC.terrain.onRunway(p.x, p.y, 60)) msgs.push({ t: 'PULL UP — TERRAIN', c: '#ff5544' });
    if (p.fuel < 15 && p.fuel > 0) msgs.push({ t: 'FUEL LOW', c: '#ffb02e' });
    if (p.fuel <= 0) msgs.push({ t: 'ENGINE OUT — GLIDE HOME', c: '#ff5544' });
    ctx.textAlign = 'center';
    ctx.font = '800 22px system-ui, sans-serif';
    for (var i = 0; i < msgs.length; i++) {
      if (Math.sin(time * 6) < -0.4 && msgs[i].c === '#ff5544') continue;
      var y = H * 0.30 + i * 30;
      ctx.fillStyle = 'rgba(20,8,8,0.55)';
      var w = ctx.measureText(msgs[i].t).width + 28;
      ctx.fillRect(W / 2 - w / 2, y - 24, w, 32);
      ctx.fillStyle = msgs[i].c;
      ctx.fillText(msgs[i].t, W / 2, y);
    }
    return msgs.length > 0;
  }

  // Arrow at the screen edge pointing to the next ring when it is off-screen.
  function ringPointer(ctx, W, H, cam, basis, focal, sortie) {
    var r = SC.missions.nextRing(sortie);
    if (!r) return;
    var pr = SC.world.project(cam, basis, focal, W, H, r.x, r.y, r.z);
    var onScreen = pr.cz > 0 && pr.sx > 40 && pr.sx < W - 40 && pr.sy > 40 && pr.sy < H - 40;
    if (onScreen) return;
    var ang;
    if (pr.cz > 0) ang = Math.atan2(pr.sy - H / 2, pr.sx - W / 2);
    else ang = Math.atan2(-(pr.cy), -(pr.cx)) + Math.PI; // behind: point down-ish
    var ex = W / 2 + Math.cos(ang) * (W / 2 - 56);
    var ey = H / 2 + Math.sin(ang) * (H / 2 - 56);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-4, 0); ctx.lineTo(-10, 10);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawHud(ctx, W, H, state) {
    var p = state.plane, sortie = state.sortie;
    if (state.view === 'chase') {
      speedTape(ctx, W, H, p);
      altitudeTape(ctx, W, H, p);
      reticle(ctx, W, H, p);
    }
    compassRibbon(ctx, W, H, p);
    if (state.view === 'cockpit') {
      // The panel carries throttle/fuel/hull; keep the objective up top.
      missionBox(ctx, W, H, sortie, p, state.liveScore, true);
    } else {
      bars(ctx, W, H, p);
      missionBox(ctx, W, H, sortie, p, state.liveScore, false);
    }
    var anyWarn = warnings(ctx, W, H, p, sortie, state.time);
    if (state.basis) ringPointer(ctx, W, H, state.camera, state.basis, state.focal, sortie);
    if (state.message && state.time < state.messageUntil) {
      ctx.textAlign = 'center';
      ctx.font = '800 26px system-ui, sans-serif';
      var w = ctx.measureText(state.message).width + 36;
      ctx.fillStyle = 'rgba(8,18,28,0.6)';
      ctx.fillRect(W / 2 - w / 2, H * 0.62 - 30, w, 42);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(state.message, W / 2, H * 0.62);
    }
    return anyWarn;
  }

  SC.hud = { drawHud: drawHud };
})();
