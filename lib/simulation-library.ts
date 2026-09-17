import {assertAccess} from "./permissions";
import type { SavedSimulation } from "../types/operations";
import type { BaselineMetrics, SimulationLevers } from "../types/simulation";
import { readLocal, writeLocal, isRecord, nonnegative } from "./local-store";
import { identifyScenario } from "./simulation/store";
import { normalizeLevers, simulate } from "./simulation";
const key=(id:string)=>`intentbridge:simulation-library:v1:${id}`;
export function validSaved(v:unknown,id:string):v is SavedSimulation {
  if(!isRecord(v)||v.advertiserId!==id||typeof v.id!=="string"||typeof v.name!=="string"||typeof v.createdAt!=="string"||![7,14,30].includes(v.period as number)||!isRecord(v.levers)||!isRecord(v.baseline)||!isRecord(v.forecast))return false;
  const b=v.baseline,f=v.forecast,l=v.levers;
  const performance=["visitors","viewContent","addToCart","checkout","directPurchases","metaPurchases","totalPurchases","recoveryPool","revenue","adSpend"];
  return ["baseline","custom","conservative","recommended","aggressive"].includes(String(v.scenario)) &&
    ["landing","cart","checkout","retargetingEfficiency","acquisitionBudget","retargetingBudget"].every(k=>typeof l[k]==="number"&&Number.isFinite(l[k])) &&
    b.advertiserId===id&&b.period===v.period&&typeof b.advertiserName==="string"&&isRecord(b.sourceChannel)&&typeof b.sourceChannel.id==="string"&&isRecord(b.retargetingChannel)&&typeof b.retargetingChannel.id==="string"&&Array.isArray(b.trafficSources)&&b.trafficSources.every(s=>isRecord(s)&&typeof s.id==="string")&&
    [...performance,"organicVisitors","paidVisitors","currentAudience","acquisitionSpend","retargetingSpend","directRevenue","recoveredRevenue"].every(k=>nonnegative(b[k]))&&performance.every(k=>nonnegative(f[k]))&&[b.cpa,b.roas,f.cpa,f.roas].every(n=>n===null||nonnegative(n))&&
    isRecord(f.confidence)&&["HIGH","MEDIUM","LOW"].includes(String(f.confidence.level))&&nonnegative(f.confidence.magnitude)&&typeof f.confidence.explanation==="string"&&
    Object.entries(normalizeLevers(l)).every(([k,n])=>l[k]===n)&&identifyScenario(normalizeLevers(l))===v.scenario&&
    f.label==="DEMO FORECAST"&&isRecord(f.levers)&&Object.entries(l).every(([k,n])=>(f.levers as Record<string,unknown>)[k]===n)&&Array.isArray(f.breakdown)&&f.breakdown.every(x=>isRecord(x)&&typeof x.id==="string"&&typeof x.label==="string"&&typeof x.delta==="number"&&Number.isFinite(x.delta)&&nonnegative(x.cumulative));
}
export function readSimulationLibrary(id:string):SavedSimulation[] {assertAccess(id);
  return readLocal<unknown[]>(key(id),[],(v):v is unknown[]=>Array.isArray(v)).filter((v):v is SavedSimulation=>validSaved(v,id));
}
export function saveNamedSimulation(b:BaselineMetrics,input:SimulationLevers,name:string):SavedSimulation {assertAccess(b.advertiserId,"MANAGE_CAMPAIGN");
  if(!name.trim()||name.length>120)throw new Error("Simulation 이름을 1~120자로 입력하세요.");
  const levers=normalizeLevers(input);
  const saved:SavedSimulation={id:crypto.randomUUID(),advertiserId:b.advertiserId,name:name.trim(),createdAt:new Date().toISOString(),scenario:identifyScenario(levers),period:b.period,levers,baseline:structuredClone(b),forecast:simulate(b,levers)};
  writeLocal(key(b.advertiserId),[saved,...readSimulationLibrary(b.advertiserId)]);return saved;
}
export function duplicateSimulation(id:string,simulationId:string) {const s=readSimulationLibrary(id).find(s=>s.id===simulationId);if(!s)throw new Error("Simulation을 찾을 수 없습니다.");return saveNamedSimulation(s.baseline,s.levers,s.name.slice(0,110)+" 복사");}
export function deleteSimulation(id:string,simulationId:string){assertAccess(id,"MANAGE_CAMPAIGN");writeLocal(key(id),readSimulationLibrary(id).filter(s=>s.id!==simulationId));}
