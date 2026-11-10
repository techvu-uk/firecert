import "server-only";
/**
 * File storage for certificate PDFs and photos.
 * Local disk by default. To use S3/Azure Blob, implement the FileStorage interface and
 * return it from getStorage() — nothing else in the app needs to change.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export interface FileStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]*$/i;

function assertSafe(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error(`Unsafe storage key: ${key}`);
}

class LocalDiskStorage implements FileStorage {
  constructor(private root: string) {}
  private resolve(key: string) {
    assertSafe(key);
    return path.join(path.resolve(this.root), key);
  }
  async put(key: string, bytes: Uint8Array) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, bytes);
  }
  async get(key: string) {
    try {
      return new Uint8Array(await readFile(this.resolve(key)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

let storage: FileStorage | null = null;
export function getStorage(): FileStorage {
  storage ??= new LocalDiskStorage(env.storageDir);
  return storage;
}
