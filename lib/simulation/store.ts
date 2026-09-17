import {businessStorage,registerStorageReset} from "../server-storage";
import {assertAccess} from "../permissions";
import { scenarios, zeroLevers } from "../../data/mock/simulation-config";
import { normalizeLevers, simulate } from "../simulation";
import type { BaselineMetrics, ScenarioSelection, SimulationLevers, SimulationSetting } from "../../types/simulation";

const memory = new Map<string, SimulationSetting>();
registerStorageReset(()=>memory.clear());
export const settingKey = (b: BaselineMetrics) => `intentbridge:simulation:v1:${b.advertiserId}:${b.period}:${b.sourceChannel.id}:${b.retargetingChannel.id}`;
export function identifyScenario(levers: SimulationLevers): ScenarioSelection {
  if (Object.values(levers).every(value => value === 0)) return "baseline";
  return scenarios.find(scenario => Object.keys(levers).every(key => scenario.levers[key as keyof SimulationLevers] === levers[key as keyof SimulationLevers]))?.id ?? "custom";
}
export function restoreSetting(b: BaselineMetrics): SimulationLevers {assertAccess(b.advertiserId);
  const key = settingKey(b);
  const cached = memory.get(key);
  if (cached) return normalizeLevers(cached.levers);
  try {
    const raw: unknown = JSON.parse(businessStorage.getItem(key) ?? "null");
    if (raw && typeof raw === "object" && "levers" in raw && raw.levers && typeof raw.levers === "object" && !Array.isArray(raw.levers)) {
      return normalizeLevers(raw.levers as Partial<SimulationLevers>);
    }
  } catch { /* Storage denial or corrupt data falls back to an unsaved baseline. */ }
  return { ...zeroLevers };
}
export function saveSetting(b: BaselineMetrics, input: SimulationLevers): "local" | "memory" {assertAccess(b.advertiserId);
  const levers = normalizeLevers(input);
  const setting: SimulationSetting = { scenario: identifyScenario(levers), levers, forecast: simulate(b, levers) };
  memory.set(settingKey(b), setting);
  try { businessStorage.setItem(settingKey(b), JSON.stringify(setting)); return "local"; }
  catch { return "memory"; }
}

export function listSimulationSettings(advertiserId: string) {assertAccess(advertiserId);
  const keys = new Set([...memory.keys()]);
  try { for (let index = 0; index < businessStorage.length; index++) { const key = businessStorage.key(index); if (key) keys.add(key); } } catch { /* Memory fallback. */ }
  const entries: { key: string; period: BaselineMetrics["period"]; levers: SimulationLevers; scenario: ScenarioSelection }[] = [];
  for (const key of keys) {
    const parts = key.split(":");
    if (!key.startsWith("intentbridge:simulation:v1:") || parts[3] !== advertiserId || !["7", "14", "30"].includes(parts[4]) || parts[5] !== "chatgpt" || parts[6] !== "meta") continue;
    try {
      const raw = memory.get(key) ?? JSON.parse(businessStorage.getItem(key) ?? "null");
      if (!raw?.levers || typeof raw.levers !== "object" || Array.isArray(raw.levers)) continue;
      const levers = normalizeLevers(raw.levers);
      entries.push({ key, period: Number(parts[4]) as BaselineMetrics["period"], levers, scenario: identifyScenario(levers) });
    } catch { /* Ignore corrupt entries. */ }
  }
  return entries.sort((a, b) => b.period - a.period);
}

export function clearSimulationSettings(advertiserId:string){assertAccess(advertiserId,"MANAGE_SETTINGS");const prefix=`intentbridge:simulation:v1:${advertiserId}:`;for(const key of [...memory.keys()])if(key.startsWith(prefix))memory.delete(key);try{const keys:string[]=[];for(let i=0;i<businessStorage.length;i++){const key=businessStorage.key(i);if(key?.startsWith(prefix))keys.push(key);}keys.forEach(k=>businessStorage.removeItem(k));}catch{/* Memory mode. */}}
