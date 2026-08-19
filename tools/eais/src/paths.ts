import { fileURLToPath } from 'node:url';
import path from 'node:path';

// This file compiles to <repoRoot>/tools/eais/dist/src/paths.js. Walking up
// from there: dist/src -> dist -> eais -> tools -> <repoRoot>.
const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..', '..', '..');

export const AI_DIR = path.join(REPO_ROOT, '.ai');
export const AUDIT_EAIS_DIR = path.join(REPO_ROOT, 'audit', 'eais');
