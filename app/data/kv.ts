import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Kv = {
  get<T>(key: readonly string[]): Promise<{ value: T | null }>;
  set(key: readonly string[], value: unknown): Promise<unknown>;
  delete?(key: readonly string[]): Promise<unknown>;
};
type DenoLike = { openKv(url?: string): Promise<Kv> };
const localPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/app-store.local.json",
);
export async function openKv(): Promise<Kv | null> {
  const deno = (globalThis as { Deno?: DenoLike }).Deno;
  return deno?.openKv ? deno.openKv(process.env.DENO_KV_URL) : null;
}
export type LocalStore = { users: Record<string, UserLike> };
export type UserLike = Record<string, unknown>;
export async function readLocal(): Promise<LocalStore> {
  try {
    return JSON.parse(await readFile(localPath, "utf8")) as LocalStore;
  } catch {
    return { users: {} };
  }
}
export async function writeLocal(store: LocalStore) {
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}
