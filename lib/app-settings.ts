import {assertAccess} from "./permissions";
import type { AppSettings } from "../types/mvp";
import { readLocal, writeLocal, isRecord, nonnegative } from "./local-store";
export const settingsKey="intentbridge:settings:v1";
export const defaultAppSettings:AppSettings={defaultPeriod:30,currency:"KRW",locale:"ko-KR",targetRoas:400,targetCpa:25000,forecastScenario:"recommended",density:"comfortable"};
export function validAppSettings(v:unknown):v is AppSettings {return isRecord(v)&&[7,14,30].includes(v.defaultPeriod as number)&&v.currency==="KRW"&&v.locale==="ko-KR"&&nonnegative(v.targetRoas)&&v.targetRoas>0&&v.targetRoas<=1e6&&nonnegative(v.targetCpa)&&v.targetCpa>0&&v.targetCpa<=1e9&&["conservative","recommended","aggressive"].includes(String(v.forecastScenario))&&["compact","comfortable"].includes(String(v.density));}
export const readAppSettings=()=>readLocal(settingsKey,defaultAppSettings,validAppSettings);
export function saveAppSettings(settings:AppSettings){assertAccess(undefined,"MANAGE_SETTINGS");if(!validAppSettings(settings))throw new Error("설정 값을 확인하세요. 현재 통화/Locale는 KRW/ko-KR만 지원합니다.");const mode=writeLocal(settingsKey,settings);if(typeof window!=="undefined")window.dispatchEvent(new Event("intentbridge-settings"));return mode;}
export const configuredTarget=()=>{const s=readAppSettings();return {cpa:s.targetCpa,roas:s.targetRoas};};
