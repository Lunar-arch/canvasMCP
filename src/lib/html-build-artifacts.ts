import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

export type HtmlAppTarget = "/" | "/dashboard" | "/setup";
export type HtmlSourceMode = "build-artifact" | "live-fetch";

const TARGET_FILE_MAP: Record<HtmlAppTarget, string> = {
  "/": "index.html",
  "/dashboard": "dashboard.html",
  "/setup": "setup.html",
};

export interface HtmlArtifactInfo {
  target: HtmlAppTarget;
  buildRoot: string;
  appArtifactDir: string;
  htmlFilePath: string;
  buildId: string;
}

export interface PreparedHtmlArtifact {
  target: HtmlAppTarget;
  buildId: string;
  sourcePath: string;
  sourceMode: HtmlSourceMode;
  html: string;
}

const WORKSPACE_ROOT = process.cwd();
const NEXT_ROOT = path.join(WORKSPACE_ROOT, ".next");
const PRIMARY_APP_ARTIFACT_DIR = path.join(NEXT_ROOT, "server", "app");

const ARTIFACT_ROOT_CANDIDATES = [
  PRIMARY_APP_ARTIFACT_DIR,
  path.join(WORKSPACE_ROOT, ".next", "standalone", ".next", "server", "app"),
];

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function targetPath(target: HtmlAppTarget): string {
  return target;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function searchForArtifactFile(
  rootDir: string,
  fileName: string,
  maxDepth = 6
): Promise<string | null> {
  type QueueNode = { dir: string; depth: number };
  const queue: QueueNode[] = [{ dir: rootDir, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    let entries: Array<Dirent<string>>;
    try {
      entries = await fs.readdir(current.dir, {
        withFileTypes: true,
        encoding: "utf8",
      });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current.dir, entry.name);
      if (entry.isFile() && entry.name === fileName) {
        return fullPath;
      }

      if (
        entry.isDirectory() &&
        current.depth < maxDepth &&
        entry.name !== "cache" &&
        entry.name !== "trace"
      ) {
        queue.push({ dir: fullPath, depth: current.depth + 1 });
      }
    }
  }

  return null;
}

async function resolveBuildIdForArtifact(artifactPath: string): Promise<{ buildId: string; buildRoot: string }> {
  let cursor = path.dirname(artifactPath);

  while (cursor.length >= WORKSPACE_ROOT.length) {
    const candidate = path.join(cursor, "BUILD_ID");
    const value = await readFileIfExists(candidate);
    if (value && value.trim()) {
      return {
        buildId: value.trim(),
        buildRoot: cursor,
      };
    }

    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  const fallbackBuildIdPath = path.join(NEXT_ROOT, "BUILD_ID");
  const fallback = await readFileIfExists(fallbackBuildIdPath);
  if (fallback && fallback.trim()) {
    return {
      buildId: fallback.trim(),
      buildRoot: NEXT_ROOT,
    };
  }

  return {
    buildId: "unknown",
    buildRoot: NEXT_ROOT,
  };
}

async function findBuildArtifactPath(target: HtmlAppTarget): Promise<string | null> {
  const targetFile = TARGET_FILE_MAP[target];

  for (const dir of ARTIFACT_ROOT_CANDIDATES) {
    const candidate = path.join(dir, targetFile);
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  // On serverless deploy targets, artifact location can differ. Search under .next as a fallback.
  if (await fileExists(NEXT_ROOT)) {
    return searchForArtifactFile(NEXT_ROOT, targetFile);
  }

  return null;
}

function absolutizeRootRelativeUrls(html: string, origin: string): string {
  const safeOrigin = trimTrailingSlashes(origin);
  let rewritten = html;

  // Rewrite root-relative URL attributes.
  rewritten = rewritten.replace(
    /\b(href|src|action|poster)=(["'])\/(?!\/)([^"']*)\2/gi,
    (_match, attr, quote, rest) => `${attr}=${quote}${safeOrigin}/${rest}${quote}`
  );

  // Rewrite root-relative _next references inside inline scripts and JSON payloads.
  rewritten = rewritten.replace(/(["'])\/_next\//g, `$1${safeOrigin}/_next/`);

  // Rewrite root-relative URLs inside inline CSS url("...") usage.
  rewritten = rewritten.replace(
    /url\(\s*(["'])\/(?!\/)([^"')]+)\1\s*\)/gi,
    (_match, quote, rest) => `url(${quote}${safeOrigin}/${rest}${quote})`
  );

  return rewritten;
}

export function resolveHtmlTarget(rawTarget?: string | null): HtmlAppTarget {
  const normalized = (rawTarget || "").trim().toLowerCase();

  if (!normalized || normalized === "/" || normalized === "index" || normalized === "home") {
    return "/";
  }

  if (normalized === "dashboard" || normalized === "/dashboard") {
    return "/dashboard";
  }

  if (normalized === "setup" || normalized === "/setup") {
    return "/setup";
  }

  return "/";
}

export async function assertBuildArtifacts(): Promise<{
  buildRoot: string;
  appArtifactDir: string;
  buildId: string;
}> {
  const buildRoot = NEXT_ROOT;
  const appArtifactDir = PRIMARY_APP_ARTIFACT_DIR;
  const buildIdPath = path.join(buildRoot, "BUILD_ID");

  try {
    await fs.access(buildRoot);
    await fs.access(appArtifactDir);
    await fs.access(buildIdPath);
  } catch {
    throw new Error(
      "Build artifacts not found. Run 'npm run build' before using /html exact-build mode."
    );
  }

  const buildId = (await fs.readFile(buildIdPath, "utf8")).trim();
  if (!buildId) {
    throw new Error("BUILD_ID is empty. Rebuild the app with 'npm run build'.");
  }

  return {
    buildRoot,
    appArtifactDir,
    buildId,
  };
}

export async function getBuildArtifactInfo(
  rawTarget?: string | null
): Promise<HtmlArtifactInfo> {
  const target = resolveHtmlTarget(rawTarget);
  const htmlFilePath = await findBuildArtifactPath(target);
  if (!htmlFilePath) {
    throw new Error(
      `Missing build HTML artifact for target '${target}'. Run 'npm run build' or use live-render fallback.`
    );
  }

  const appArtifactDir = path.dirname(htmlFilePath);
  const { buildId, buildRoot } = await resolveBuildIdForArtifact(htmlFilePath);

  return {
    target,
    buildRoot,
    appArtifactDir,
    htmlFilePath,
    buildId,
  };
}

export async function prepareBuiltHtmlDocument(
  origin: string,
  rawTarget?: string | null
): Promise<PreparedHtmlArtifact> {
  const info = await getBuildArtifactInfo(rawTarget);
  const html = await fs.readFile(info.htmlFilePath, "utf8");
  const rewritten = absolutizeRootRelativeUrls(html, origin);

  return {
    target: info.target,
    buildId: info.buildId,
    sourcePath: info.htmlFilePath,
    sourceMode: "build-artifact",
    html: rewritten,
  };
}

async function prepareLiveHtmlDocument(
  origin: string,
  rawTarget?: string | null
): Promise<PreparedHtmlArtifact> {
  const target = resolveHtmlTarget(rawTarget);
  const safeOrigin = trimTrailingSlashes(origin);
  const pageUrl = `${safeOrigin}${targetPath(target)}`;

  const response = await fetch(pageUrl, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "x-studyflow-html-render": "1",
      "x-studyflow-html-target": target,
    },
  });

  if (!response.ok) {
    throw new Error(`Live HTML fetch failed for '${target}' (${response.status}).`);
  }

  const html = await response.text();
  if (!html || !html.trim()) {
    throw new Error(`Live HTML fetch returned an empty document for '${target}'.`);
  }

  const rewritten = absolutizeRootRelativeUrls(html, safeOrigin);
  const buildIdHeader = response.headers.get("x-vercel-id") || response.headers.get("x-nextjs-cache");

  return {
    target,
    buildId: buildIdHeader || "live-fetch",
    sourcePath: pageUrl,
    sourceMode: "live-fetch",
    html: rewritten,
  };
}

export async function detectHtmlSourceMode(rawTarget?: string | null): Promise<HtmlSourceMode> {
  try {
    await getBuildArtifactInfo(rawTarget);
    return "build-artifact";
  } catch {
    return "live-fetch";
  }
}

export async function prepareHtmlDocument(
  origin: string,
  rawTarget?: string | null
): Promise<PreparedHtmlArtifact> {
  try {
    return await prepareBuiltHtmlDocument(origin, rawTarget);
  } catch (buildError) {
    try {
      return await prepareLiveHtmlDocument(origin, rawTarget);
    } catch (liveError) {
      const buildMessage = buildError instanceof Error ? buildError.message : String(buildError);
      const liveMessage = liveError instanceof Error ? liveError.message : String(liveError);
      throw new Error(
        `Unable to prepare HTML payload from build artifact or live fetch. Build error: ${buildMessage}. Live error: ${liveMessage}`
      );
    }
  }
}
