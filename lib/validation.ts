import { MAX_INPUT_BYTES } from "./shared";

export function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function assertWithinInputLimit(value: string): void {
  if (byteLength(value) > MAX_INPUT_BYTES) {
    throw new Error(`Input exceeds ${MAX_INPUT_BYTES} bytes.`);
  }
}

export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
