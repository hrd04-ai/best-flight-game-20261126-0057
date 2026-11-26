#!/usr/bin/env python3
"""Play-test + screenshot driver for Sky Courier — Island Rings.
Loads the game in headless Chromium, checks console errors, flies a scripted
sortie (takeoff, ring pass, cockpit toggle, landing, crash, pause/restart),
then captures the 4 staged screenshots at 1280x720 JPEG."""
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8977/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
os.makedirs(OUT, exist_ok=True)

results = {"console_errors": [], "steps": {}}

def state(pg):
    return pg.evaluate("""() => {
      const g = window.__SC.game, p = g.plane;
      return {screen: g.screen, view: g.view, x: p.x, y: p.y, z: p.z,
        speed: p.speed, vspeed: p.vspeed, heading: p.heading, pitch: p.pitch,
        roll: p.roll, throttle: p.throttle, onGround: p.onGround,
        gearDown: p.gearDown, flaps: p.flaps, fuel: p.fuel, hull: p.hull,
        ringsDone: g.sortie ? g.sortie.ringsDone : -1,
        ringsTotal: g.sortie ? g.sortie.rings.length : -1,
        touchdown: p.lastTouchdown ? p.lastTouchdown.grade : null,
        debrief: g.debrief ? g.debrief.total : null,
        crashReason: g.crashReason};
    }""")

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    pg = browser.new_page(viewport={"width": 1280, "height": 720})
    pg.on("console", lambda m: results["console_errors"].append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: results["console_errors"].append(str(e)))

    # --- interactive play-test -------------------------------------------
    pg.goto(BASE)
    pg.wait_for_function("window.__SC_READY === true", timeout=15000)
    pg.wait_for_timeout(400)
    results["steps"]["title_screen"] = state(pg)["screen"]

    pg.keyboard.press("1")  # start sortie 1
    pg.wait_for_timeout(300)
    results["steps"]["sortie_started"] = state(pg)["screen"]

    # Full throttle and rotate.
    pg.keyboard.down("Shift")
    pg.wait_for_timeout(6500)
    pg.keyboard.down("ArrowUp")
    pg.wait_for_timeout(2500)
    s = state(pg)
    results["steps"]["after_takeoff"] = {k: s[k] for k in ("onGround", "speed", "z", "vspeed")}
    pg.keyboard.up("ArrowUp")

    # Climb a bit, gear up, bank right.
    pg.keyboard.press("g")
    pg.wait_for_timeout(1500)
    pg.keyboard.down("ArrowRight")
    pg.wait_for_timeout(1800)
    pg.keyboard.up("ArrowRight")
    s = state(pg)
    results["steps"]["after_turn"] = {k: s[k] for k in ("heading", "roll", "gearDown")}

    # Teleport onto the approach to ring 1 and fly through it.
    pg.evaluate("""() => {
      const g = window.__SC.game, p = g.plane, r = g.sortie.rings[0];
      p.x = r.x - r.nx * 260; p.y = r.y - r.ny * 260; p.z = r.z;
      p.heading = (Math.atan2(r.nx, r.ny) * 180 / Math.PI + 360) % 360;
      p.pitch = 0; p.roll = 0; p.speed = 52; p.vspeed = 0; p.throttle = 0.7;
      p.onGround = false; p.gearDown = false;
      g.snapCamera();
    }""")
    pg.wait_for_timeout(6000)
    s = state(pg)
    results["steps"]["after_ring"] = {"ringsDone": s["ringsDone"]}

    # Cockpit toggle.
    pg.keyboard.press("c")
    pg.wait_for_timeout(400)
    results["steps"]["cockpit_view"] = state(pg)["view"]
    pg.keyboard.press("c")
    pg.wait_for_timeout(300)
    results["steps"]["chase_view_back"] = state(pg)["view"]

    # Pause / resume.
    pg.keyboard.press("p")
    pg.wait_for_timeout(250)
    results["steps"]["paused"] = state(pg)["screen"]
    pg.keyboard.press("p")
    pg.wait_for_timeout(250)
    results["steps"]["resumed"] = state(pg)["screen"]

    # Stage a landing: final approach, gentle descent, all rings done.
    pg.evaluate("""() => {
      const g = window.__SC.game, p = g.plane;
      g.sortie.rings.forEach(r => r.passed = true);
      g.sortie.ringsDone = g.sortie.rings.length;
      p.x = -900; p.y = -1500; p.z = 26; p.heading = 90; p.pitch = -2;
      p.roll = 0; p.speed = 31; p.vspeed = -1.6; p.throttle = 0.25;
      p.gearDown = true; p.flaps = true; p.onGround = false;
      g.snapCamera();
    }""")
    pg.keyboard.up("Shift")
    # Ride it down: ease the nose as it settles.
    for _ in range(40):
        pg.wait_for_timeout(500)
        s = state(pg)
        if s["onGround"] or s["screen"] in ("debrief", "crash"):
            break
        if s["vspeed"] < -2.2:
            pg.keyboard.down("ArrowUp"); pg.wait_for_timeout(220); pg.keyboard.up("ArrowUp")
    s = state(pg)
    results["steps"]["after_landing"] = {k: s[k] for k in ("onGround", "touchdown", "screen", "hull")}

    # Brake to a stop -> debrief should appear.
    pg.keyboard.down("b")
    for _ in range(24):
        pg.wait_for_timeout(500)
        s = state(pg)
        if s["screen"] == "debrief":
            break
    pg.keyboard.up("b")
    s = state(pg)
    results["steps"]["debrief"] = {"screen": s["screen"], "score": s["debrief"]}

    # Restart, then crash on purpose (dive into the sea).
    pg.keyboard.press("r")
    pg.wait_for_timeout(400)
    pg.evaluate("""() => {
      const g = window.__SC.game, p = g.plane;
      p.x = 2600; p.y = 2600; p.z = 34; p.heading = 45; p.pitch = -25;
      p.speed = 62; p.vspeed = -15; p.throttle = 0; p.onGround = false;
      g.snapCamera();
    }""")
    pg.keyboard.down("ArrowDown")
    for _ in range(30):
        pg.wait_for_timeout(400)
        s = state(pg)
        if s["screen"] == "crash":
            break
    pg.keyboard.up("ArrowDown")
    s = state(pg)
    results["steps"]["crash"] = {"screen": s["screen"], "reason": s["crashReason"]}

    # --- staged screenshots ----------------------------------------------
    shots = [("title", "1-title.jpg"), ("chase", "2-chase-rings.jpg"),
             ("cockpit", "3-cockpit.jpg"), ("landing", "4-landing.jpg")]
    for param, fname in shots:
        pg.goto(BASE + "?shot=" + param)
        pg.wait_for_function("window.__SC_READY === true", timeout=15000)
        pg.wait_for_timeout(900)
        path = os.path.join(OUT, fname)
        pg.screenshot(path=path, type="jpeg", quality=82)
        results["steps"]["shot_" + param] = {"file": fname, "bytes": os.path.getsize(path)}

    browser.close()

print(json.dumps(results, indent=2))
