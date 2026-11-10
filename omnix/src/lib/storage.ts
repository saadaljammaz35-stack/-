import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/config/env";
import { AppError } from "@/lib/http/errors";

// Local-filesystem object storage. Paths are built only from server-generated
// UUIDs and hashes; the client filename is never used as a path component.
// Production deployments mount a persistent volume here (see
// AI_MODEL_DEPLOYMENT.md); an S3 driver can replace this module behind the
// same three functions.

function root(): string {
  return path.resolve(env().OMNIX_STORAGE_DIR);
}

function resolveSafe(rel: string): string {
  if (!/^[a-z0-9/_.-]+$/i.test(rel) || rel.includes("..")) throw new AppError("INTERNAL", "Invalid storage path");
  const abs = path.resolve(root(), rel);
  if (!abs.startsWith(root() + path.sep)) throw new AppError("INTERNAL", "Storage path escapes root");
  return abs;
}

export async function putObject(rel: string, data: Uint8Array): Promise<void> {
  const abs = resolveSafe(rel);
  await mkdir(path.dirname(abs), { recursive: true, mode: 0o700 });
  await writeFile(abs, data, { mode: 0o600 });
}

export async function getObject(rel: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(resolveSafe(rel)));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new AppError("NOT_FOUND", "Stored file is missing");
    throw err;
  }
}

export async function deleteObject(rel: string): Promise<void> {
  await rm(resolveSafe(rel), { force: true });
}
