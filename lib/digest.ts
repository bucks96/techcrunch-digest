/** Server-only — uses Node.js `fs`. Never import this from a Client Component. */
import { readFileSync } from "fs";
import { join } from "path";
import type { DigestData, DigestIndex } from "./types";

const DATA_DIR = join(process.cwd(), "public", "data");

export function getIndex(): DigestIndex | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "index.json"), "utf8");
    return JSON.parse(raw) as DigestIndex;
  } catch {
    return null;
  }
}

export function getDigest(date: string): DigestData | null {
  try {
    const raw = readFileSync(join(DATA_DIR, `digest-${date}.json`), "utf8");
    return JSON.parse(raw) as DigestData;
  } catch {
    return null;
  }
}
