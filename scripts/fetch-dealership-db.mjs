/**
 * Ensure the read-only dealership SQLite file exists before `next build`.
 * Locally the file is already on disk. On App Hosting it is downloaded from
 * the public GitHub Release on DavidSolesbee/David-Solesbee.
 */
import { createWriteStream } from "node:fs";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const dest =
  process.env.PERSEUS_DEALERSHIP_DB ?? "perseus_equipment_database.db";
const url =
  process.env.PERSEUS_DEALERSHIP_DB_URL ??
  "https://github.com/DavidSolesbee/David-Solesbee/releases/download/dealership-data/perseus_equipment_database.db";

const MIN_BYTES = 100 * 1024 * 1024;

if (fs.existsSync(dest) && fs.statSync(dest).size > MIN_BYTES) {
  console.log("Dealership database already present.");
  process.exit(0);
}

console.log("Downloading dealership database from GitHub…");
const res = await fetch(url, { redirect: "follow" });
if (!res.ok || !res.body) {
  throw new Error(`Download failed ${res.status} ${res.statusText}: ${url}`);
}
await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
const size = fs.statSync(dest).size;
if (size < MIN_BYTES) {
  throw new Error(`Downloaded file too small (${size} bytes): ${dest}`);
}
console.log(`Wrote ${dest} (${size} bytes)`);
