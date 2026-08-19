/**
 * Pinned browser launch.
 *
 * The repo's playwright package expects a chromium build this image does not
 * ship (it has 1194, playwright wants 1208), and downloading browsers is not
 * permitted here. We therefore resolve the installed executable explicitly.
 *
 * Every stage launches through this helper so that reference captures, fixture
 * renders, and site baselines all come from one identical browser. Visual
 * comparison across differing browser builds is meaningless, so the resolved
 * path and version are recorded for the environment manifest.
 */

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const CANDIDATES = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
];

let cached = null;

export function resolveChromium() {
  if (cached) return cached;
  const executablePath = CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!executablePath) {
    throw new Error(
      `No chromium executable found. Looked in:\n  ${CANDIDATES.join('\n  ')}`
    );
  }
  let version = 'unknown';
  try {
    version = execFileSync(executablePath, ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    // Version probing is best-effort; a missing version is recorded, not fatal.
  }
  cached = { executablePath, version };
  return cached;
}

export async function launchBrowser(options = {}) {
  const { executablePath } = resolveChromium();
  return chromium.launch({ headless: true, executablePath, ...options });
}

/** Rendering conditions that must be identical across every capture. */
export const CAPTURE_ENVIRONMENT = Object.freeze({
  deviceScaleFactor: 1,
  colorScheme: 'light',
  locale: 'en-US',
  timezoneId: 'UTC',
});

export function environmentManifest() {
  const { executablePath, version } = resolveChromium();
  return {
    browser: { executablePath, version },
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    capture: CAPTURE_ENVIRONMENT,
  };
}
