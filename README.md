# Sky Courier — Island Rings

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/hrd04-ai/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/hrd04-ai/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)


![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform: Browser](https://img.shields.io/badge/platform-browser-orange.svg)
![Offline: yes](https://img.shields.io/badge/offline-yes-green.svg)
![Entry fee: free](https://img.shields.io/badge/entry-free-brightgreen.svg)

An original browser flight game built for the make.fun bounty
**[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057)**.

You fly the mail plane *Kestrel* over a volcanic island: take off from the
runway, thread glowing delivery rings over the bay, the volcano ridge and the
lighthouse, then bring her home and grease the landing. Three sorties, rising
wind, dusk lighting, tight fuel — every landing is graded
GREASED / FIRM / HARD / CRASH.

Everything is drawn in code on a Canvas 2D pseudo-3D renderer: sea, sandy
coasts, green hills, a smoking volcano, palm trees, a lighthouse, a striped
runway and floating target rings. Sounds are synthesized with WebAudio.
No external assets, no network requests — open `game/index.html` in desktop
Chrome and fly.

## How to play

1. Pick a sortie on the title screen (keys `1` `2` `3` or click).
2. Throttle up, rotate at ~55 kt, climb out.
3. Fly through every glowing ring in order (the gold ring is next).
4. Come home: gear down (`G`), flaps (`F`), line up with the runway,
   touch down slow and shallow for a GREASED landing.
5. Score = rings + landing quality + time bonus − damage. Hull at 0 = crash.

| Control | Keys / mouse |
| --- | --- |
| Throttle | `Shift` / `Ctrl`, `W` / `S`, mouse wheel |
| Pitch | `↑` / `↓` or mouse up/down |
| Roll / turn | `←` / `→`, `A` / `D`, mouse left/right |
| Rudder (fine turn) | `Q` / `E` |
| Flaps | `F` |
| Landing gear | `G` |
| Brake (on ground) | `B` |
| Camera: chase / cockpit | `C` |
| Pause | `P` |
| Mute | `M` |
| Restart sortie | `R` |

Watch the stall: slow flight with the nose high drops the wing — push the
nose down and add power. Fuel burns with throttle; an empty tank means a
glide home. Sortie 2 adds gusting wind, sortie 3 flies at dusk on tight fuel.

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
`vendor/makefun-game.ts` `buildDossier`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are real renders of the game itself
(`?shot=title|chase|cockpit|landing` boots deterministic staging states).
