#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { spawnSync } = require("node:child_process");

const DEFAULT_SAMPLE_URL =
  "https://github.com/vikramsoni2/nextExplorer/releases/download/v2.0.0/samples.zip";

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
  }
  return value;
}

async function emptyDir(dir) {
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
}

function configureFetchNetworking() {
  const connectTimeoutMs = envInt("SAMPLES_CONNECT_TIMEOUT_MS", 60_000);
  const headersTimeoutMs = envInt("SAMPLES_HEADERS_TIMEOUT_MS", 60_000);
  const bodyTimeoutMs = envInt("SAMPLES_BODY_TIMEOUT_MS", 10 * 60_000);

  try {
    const { Agent, setGlobalDispatcher } = require("undici");
    setGlobalDispatcher(
      new Agent({
        connectTimeout: connectTimeoutMs,
        headersTimeout: headersTimeoutMs,
        bodyTimeout: bodyTimeoutMs,
      })
    );
  } catch {
    // If undici isn't available for some reason, node's fetch defaults still apply.
  }

  return { connectTimeoutMs, headersTimeoutMs, bodyTimeoutMs };
}

async function downloadToFile(url, filePath, { requestTimeoutMs }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status} ${response.statusText}`);
  }
  if (!response.body) throw new Error(`No response body when downloading ${url}`);

  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const writable = fs.createWriteStream(filePath);
  await pipeline(Readable.fromWeb(response.body), writable);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCause(err) {
  const cause = err?.cause;
  if (!cause) return "";
  const code = cause.code ? ` (${cause.code})` : "";
  const message = cause.message ? `: ${cause.message}` : "";
  return `${code}${message}`;
}

async function downloadToFileWithRetries(url, filePath, { requestTimeoutMs, retries, backoffMs }) {
  let lastErr;
  for (let attempt = 1; attempt <= Math.max(1, retries); attempt++) {
    try {
      await downloadToFile(url, filePath, { requestTimeoutMs });
      return;
    } catch (err) {
      lastErr = err;
      const suffix = formatCause(err);
      if (attempt >= retries) break;
      const waitMs = backoffMs * attempt;
      console.warn(
        `WARN: Download attempt ${attempt}/${retries} failed${suffix}; retrying in ${waitMs}ms`
      );
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

async function removeMacJunk(rootDir) {
  await fsp.rm(path.join(rootDir, "__MACOSX"), { recursive: true, force: true });

  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let dirents;
    try {
      dirents = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const dirent of dirents) {
      const fullPath = path.join(current, dirent.name);
      if (dirent.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (dirent.name === ".DS_Store" || dirent.name.startsWith("._")) {
        await fsp.rm(fullPath, { force: true });
      }
    }
  }
}

async function chmodReadOnlyRecursive(rootDir) {
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let stat;
    try {
      stat = await fsp.lstat(current);
    } catch {
      continue;
    }

    if (stat.isSymbolicLink()) continue;

    if (stat.isDirectory()) {
      await fsp.chmod(current, 0o555);
      let dirents;
      try {
        dirents = await fsp.readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const dirent of dirents) {
        stack.push(path.join(current, dirent.name));
      }
    } else if (stat.isFile()) {
      await fsp.chmod(current, 0o444);
    }
  }
}

async function main() {
  const sampleUrl = requireEnv("SAMPLE_URL", DEFAULT_SAMPLE_URL);
  const samplesDir = requireEnv("SAMPLES_DIR", "/mnt/Samples");
  const tmpDir = process.env.SAMPLES_TMP_DIR || "/tmp/demo-seed";
  const zipPath = process.env.SAMPLES_ZIP_PATH || path.join(tmpDir, "samples.zip");
  const retries = envInt("SAMPLES_DOWNLOAD_RETRIES", 5);
  const backoffMs = envInt("SAMPLES_DOWNLOAD_BACKOFF_MS", 2_000);
  const requestTimeoutMs = envInt("SAMPLES_REQUEST_TIMEOUT_MS", 10 * 60_000);

  configureFetchNetworking();

  console.log(`INFO: Downloading samples from ${sampleUrl}`);
  await emptyDir(tmpDir);
  await emptyDir(samplesDir);

  await downloadToFileWithRetries(sampleUrl, zipPath, {
    requestTimeoutMs,
    retries,
    backoffMs,
  });

  console.log(`INFO: Extracting ${zipPath} to ${samplesDir}`);
  const unzip = spawnSync("unzip", ["-q", zipPath, "-d", samplesDir], { stdio: "inherit" });
  if (unzip.error) throw unzip.error;
  if (unzip.status !== 0) throw new Error(`unzip failed with exit code ${unzip.status}`);

  await removeMacJunk(samplesDir);
  await chmodReadOnlyRecursive(samplesDir);

  console.log("INFO: Demo samples ready.");
}

main().catch((err) => {
  console.error("ERROR: downloadSamples failed:", err);
  process.exit(1);
});
