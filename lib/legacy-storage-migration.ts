import {createBackup,validateBackup} from "./backup-service";
import {assertAccess} from "./permissions";
import {identifyScenario} from "./simulation/store";
import {normalizeLevers} from "./simulation";
// Explicit, reviewed one-way import. Never reads auth, credentials or arbitrary keys.
export function reviewLegacyStorage(){
 assertAccess(undefined,"MANAGE_SETTINGS");const backup=createBackup();const keys:string[]=[];
 const read=(key:string)=>{const value=localStorage.getItem(key);if(value===null)return undefined;keys.push(key);return JSON.parse(value)};
 const settings=read("intentbridge:settings:v1");if(settings)backup.userSettings=settings;
 for(const item of backup.advertisers){const id=item.advertiser.id;
  item.campaigns=read(`intentbridge:campaigns:v1:${id}`)??item.campaigns;
  item.operations=read(`intentbridge:operations:v1:${id}`)??item.operations;
  item.simulations=read(`intentbridge:simulation-library:v1:${id}`)??item.simulations;
  item.settings=backup.userSettings;
  for(const period of [7,14,30] as const){const old=read(`intentbridge:simulation:v1:${id}:${period}:chatgpt:meta`);if(old?.levers){const levers=normalizeLevers(old.levers);item.currentSimulations=item.currentSimulations.filter(s=>s.period!==period);item.currentSimulations.push({period,levers,scenario:identifyScenario(levers)});}}
 }
 if(!keys.length)throw new Error("이 브라우저에서 이전할 기존 데이터가 없습니다.");
 const validation=validateBackup(backup);if(!validation.valid)throw new Error(validation.errors.join(" / "));
 return {backup,keys};
}
