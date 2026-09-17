import { isRecord } from "./local-store";
// Explicit dispatcher: unknown/future schemas never get guessed or silently down-converted.
export function migrateBackup(value:unknown):unknown {if(!isRecord(value)||value.schemaVersion!=="1.0")throw new Error("지원하지 않는 Schema Version입니다. 현재 1.0만 가져올 수 있습니다.");return structuredClone(value);}
