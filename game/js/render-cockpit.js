// Cockpit: the lit instrument panel seen with the C key — artificial
// horizon, altimeter and airspeed gauges, compass card, fuel gauge,
// gear lights, throttle quadrant and warning lamps.
(function () {
  'use strict';
  var SC = window.SC;
  var flight = SC.flight;

  function gaugeBezel(ctx, x, y, r) {
    ctx.fillStyle = '#14181e';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#3d4654';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,150,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r - 3, 0, 6.2832); ctx.stroke();
  }

  function artificialHorizon(ctx, x, y, r, p) {
    gaugeBezel(ctx, x, y, r);
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r - 4, 0, 6.2832); ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-SC.rad(p.roll));
    var pitchPx = SC.clamp(p.pitch, -30, 30) * (r / 28);
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r * 1.6, -r * 1.6 + pitchPx, r * 3.2, r * 1.6);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-r * 1.6, pitchPx, r * 3.2, r * 1.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r * 1.6, pitchPx - 1, r * 3.2, 2);
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    [-20, -10, 10, 20].forEach(function (d) {
      var yy = pitchPx - d * (r / 28);
      ctx.fillRect(-r * 0.3, yy, r * 0.6, 1.4);
    });
    ctx.restore();
    // Fixed aircraft symbol.
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.55, y); ctx.lineTo(x - r * 0.16, y); ctx.lineTo(x - r * 0.16, y + r * 0.12);
    ctx.moveTo(x + r * 0.55, y); ctx.lineTo(x + r * 0.16, y); ctx.lineTo(x + r * 0.16, y + r * 0.12);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#9fb4c8';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', x, y + r + 13);
  }

  function needleGauge(ctx, x, y, r, frac, label, digital, dangerFrom) {
    gaugeBezel(ctx, x, y, r);
    var a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    ctx.strokeStyle = '#cfe3f2';
    ctx.lineWidth = 2;
    for (var i = 0; i <= 10; i++) {
      var a = a0 + (a1 - a0) * (i / 10);
      var big = i % 5 === 0;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - (big ? 11 : 7)), y + Math.sin(a) * (r - (big ? 11 : 7)));
      ctx.lineTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
      ctx.stroke();
    }
    if (dangerFrom !== undefined) {
      ctx.strokeStyle = '#ff5544';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r - 8, a0 + (a1 - a0) * dangerFrom, a1);
      ctx.stroke();
    }
    var na = a0 + (a1 - a0) * SC.clamp(frac, 0, 1);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(na) * (r - 10), y + Math.sin(na) * (r - 10));
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '800 ' + Math.round(r * 0.34) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(digital, x, y + r * 0.52);
    ctx.fillStyle = '#9fb4c8';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText(label, x, y + r + 13);
  }

  function compassCard(ctx, x, y, r, p) {
    gaugeBezel(ctx, x, y, r);
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r - 4, 0, 6.2832); ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-SC.rad(p.heading));
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    var names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    for (var d = 0; d < 360; d += 30) {
      var a = SC.rad(d) - Math.PI / 2;
      ctx.fillStyle = names[d] ? '#ffd23f' : '#cfe3f2';
      ctx.fillText(names[d] || String(d / 10), Math.cos(a) * (r - 16), Math.sin(a) * (r - 16) + 5);
      ctx.fillRect(Math.cos(a) * (r - 8) - 1, Math.sin(a) * (r - 8) - 1, 2, 2);
    }
    ctx.restore();
    ctx.fillStyle = '#ff5544';
    ctx.beginPath();
    ctx.moveTo(x - 5, y - r + 2); ctx.lineTo(x + 5, y - r + 2); ctx.lineTo(x, y - r + 11);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(SC.wrap360(p.heading))).padStart(3, '0') + '°', x, y + 5);
    ctx.fillStyle = '#9fb4c8';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText('HEADING', x, y + r + 13);
  }

  function drawCockpit(ctx, W, H, p, time) {
    var panelH = Math.round(H * 0.34);
    var top = H - panelH;
    // Window pillars and glareshield.
    ctx.fillStyle = '#232830';
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(0, top + panelH * 0.28);
    ctx.quadraticCurveTo(W * 0.5, top - panelH * 0.10, W, top + panelH * 0.28);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2e3540';
    ctx.fillRect(0, 0, 26, top + panelH * 0.2);
    ctx.fillRect(W - 26, 0, 26, top + panelH * 0.2);
    ctx.fillRect(W / 2 - 9, 0, 18, top * 0.55);
    // Panel face.
    var g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#39424f'); g.addColorStop(1, '#22272f');
    ctx.fillStyle = g;
    ctx.fillRect(26, top + panelH * 0.22, W - 52, panelH);
    // Rivets.
    ctx.fillStyle = 'rgba(200,215,230,0.35)';
    for (var rx = 44; rx < W - 40; rx += 46) {
      ctx.beginPath(); ctx.arc(rx, top + panelH * 0.30, 2, 0, 6.2832); ctx.fill();
    }
    var cy = top + panelH * 0.58;
    var r = Math.min(panelH * 0.30, 62);
    var cx1 = W * 0.16, cx2 = W * 0.34, cx3 = W * 0.52, cx4 = W * 0.70;
    needleGauge(ctx, cx1, cy, r, flight.knots(p.speed) / 180, 'AIRSPEED KT',
      String(Math.round(flight.knots(p.speed))));
    artificialHorizon(ctx, cx2, cy, r, p);
    needleGauge(ctx, cx3, cy, r, flight.feet(p.z) / 3000, 'ALTIMETER FT',
      String(Math.round(flight.feet(p.z))).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
    compassCard(ctx, cx4, cy, r, p);
    // Right cluster: fuel, gear lights, throttle, warning lamps.
    var fx = W * 0.845;
    needleGauge(ctx, fx, cy - r * 0.15, r * 0.72, p.fuel / 100, 'FUEL',
      Math.round(p.fuel) + '%', undefined);
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fb4c8';
    ctx.fillText('GEAR', fx, cy + r * 0.95);
    for (var gi = 0; gi < 3; gi++) {
      ctx.fillStyle = p.gearDown ? '#57e389' : (Math.sin(time * 5) > 0 ? '#ff5544' : '#5a2a26');
      ctx.beginPath();
      ctx.arc(fx - 18 + gi * 18, cy + r * 1.12, 5.5, 0, 6.2832);
      ctx.fill();
    }
    // Throttle quadrant.
    var tx = W * 0.925, ty = top + panelH * 0.34, th = panelH * 0.44;
    ctx.fillStyle = '#14181e';
    ctx.fillRect(tx - 11, ty, 22, th);
    ctx.fillStyle = '#e8722a';
    var leverY = ty + th * (1 - p.throttle);
    ctx.fillRect(tx - 13, leverY - 5, 26, 10);
    ctx.fillStyle = '#9fb4c8';
    ctx.fillText('THR', tx, ty + th + 14);
    ctx.fillStyle = '#eaf7ff';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillText(Math.round(p.throttle * 100) + '%', tx, ty - 6);
    // Warning lamps row.
    var lamps = [
      { label: 'STALL', on: p.stalled, color: '#ff5544' },
      { label: 'FUEL', on: p.fuel < 15, color: '#ffb02e' },
      { label: 'GEAR', on: !p.gearDown && !p.onGround, color: '#ffb02e' },
      { label: 'HULL', on: p.hull < 40, color: '#ff5544' }
    ];
    ctx.font = '700 9px system-ui, sans-serif';
    for (var li = 0; li < lamps.length; li++) {
      var lx = W * 0.60 + li * 52, ly = top + panelH * 0.30;
      ctx.fillStyle = lamps[li].on && Math.sin(time * 6) > -0.3 ? lamps[li].color : '#2c333d';
      ctx.fillRect(lx - 22, ly - 9, 44, 18);
      ctx.fillStyle = lamps[li].on ? '#14181e' : '#7d8b9c';
      ctx.fillText(lamps[li].label, lx, ly + 3);
    }
  }

  SC.cockpit = { drawCockpit: drawCockpit };
})();
