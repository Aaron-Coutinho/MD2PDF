import { existsSync } from "node:fs";

const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];

export function resolveBrowserExecutablePath(): string {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;

  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }

  const local = browserCandidates.find((candidate) => existsSync(candidate));

  if (local) {
    return local;
  }

  throw new Error("No Chrome or Edge executable found. Set PUPPETEER_EXECUTABLE_PATH in .env.local.");
}
