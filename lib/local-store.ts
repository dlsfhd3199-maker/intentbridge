import {runtimeScope} from "./runtime-scope";
import {businessStorage,registerStorageReset} from "./server-storage";
const memory = new Map<string,unknown>();
registerStorageReset(()=>memory.clear());
export function readLocal<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  try { const value = (runtimeScope()?undefined:memory.get(key)) ?? JSON.parse(businessStorage.getItem(key) ?? "null"); if (validate(value)) return structuredClone(value); } catch { /* Unavailable or corrupt storage. */ }
  return structuredClone(fallback);
}
export function writeLocal<T>(key: string, value: T): "local" | "memory" {
  memory.set(key,structuredClone(value));
  try { businessStorage.setItem(key,JSON.stringify(value)); return "local"; } catch { return "memory"; }
}
export const isRecord = (v: unknown): v is Record<string,unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const nonnegative = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
