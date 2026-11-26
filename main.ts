// Sky Courier — Island Rings: hand-in program for the make.fun flight-game bounty.
// Node 22, standard library only. It copies this repository's game/ and screenshots/
// folders beside itself into the output directory (/output in the grader, or
// MAKEFUN_OUTPUT_DIR when run locally) and writes dossier.json there with the
// vendored make.fun library's buildDossier. Both grader runs must write identical
// bytes, so nothing here depends on time, randomness or the network.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Caps mirror the scorer's gate: dossier text capped at 163840 bytes, at most 4
// screenshots of at most 262144 bytes each, game/ at most 993 entries and
// 50331648 bytes in total, no game/ path longer than 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
