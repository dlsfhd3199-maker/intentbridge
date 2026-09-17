import {runtimeScope} from "./runtime-scope";
// Existing synchronous store contracts are backed by atomic, acknowledged server batches.
let commands=0;let commandQueue:Promise<unknown>=Promise.resolve();
let installed=false,holding=0,running=false,error="",scheduled=false;
const values=new Map<string,string>(),acknowledged=new Map<string,string>(),revisions=new Map<string,number>(),pending=new Map<string,string|null>();
const listeners=new Set<()=>void>(),resets=new Set<()=>void>();
let intent:"import"|undefined;
type Batch={id:string;intent?:"import";documents:{key:string;payload:unknown;revision:number}[]};let failed:Batch|undefined;
export function registerStorageReset(fn:()=>void){resets.add(fn)}
const emit=()=>listeners.forEach(fn=>fn());
export function storageStatus(){return {pending:commands+pending.size+(failed?.documents.length??0)+(running?1:0),error};}
export function subscribeStorage(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}}
export function installServerStorage(documents:{key:string;payload:unknown;revision:number}[]){installed=true;values.clear();acknowledged.clear();revisions.clear();pending.clear();failed=undefined;error="";mergeServerStorage(documents);resets.forEach(fn=>fn());emit()}
export function mergeServerStorage(documents:{key:string;payload:unknown;revision:number}[]){for(const d of documents){const value=JSON.stringify(d.payload);values.set(d.key,value);acknowledged.set(d.key,value);revisions.set(d.key,d.revision)}emit()}
function schedule(){if(scheduled||holding)return;scheduled=true;setTimeout(()=>{scheduled=false;void drain()},0)}
async function drain(){if(running||error||holding)return;running=true;emit();try{while(failed||pending.size){const batch=failed??{id:crypto.randomUUID(),intent,documents:[...pending].map(([key,value])=>({key,payload:value===null?null:JSON.parse(value),revision:revisions.get(key)??0}))};if(!failed)pending.clear();failed=batch;try{const response=await fetch("/api/workspace-data",{method:"PUT",headers:{"Content-Type":"application/json","Idempotency-Key":batch.id},body:JSON.stringify({documents:batch.documents,intent:batch.intent})});const body=await response.json();if(!response.ok)throw new Error(response.status===401?"세션이 만료되었습니다. 새 창에서 로그인한 뒤 저장을 다시 시도하세요.":(body.error??"서버에 저장하지 못했습니다.")+(body.requestId?" Reference: "+body.requestId:""));for(const d of body.documents)revisions.set(d.key,d.revision);for(const d of batch.documents){const value=JSON.stringify(d.payload??{});acknowledged.set(d.key,value);if(!pending.has(d.key))values.set(d.key,value);}failed=undefined;}catch(e){error=e instanceof Error?e.message:"저장 실패";for(const d of batch.documents){const old=acknowledged.get(d.key);if(old===undefined)values.delete(d.key);else values.set(d.key,old);}resets.forEach(fn=>fn());break;}}}finally{running=false;emit()}}
export function retryServerStorage(){error="";void drain()}
export async function flushServerStorage(){await drain();while(running)await new Promise(r=>setTimeout(r,25));if(error||failed||pending.size)throw new Error(error||"저장 중입니다.")}
export async function atomicStoreChange<T>(fn:()=>T|Promise<T>,action?:"import"):Promise<T>{if(!installed)return fn();commands++;emit();const task=commandQueue.then(async()=>{try{await flushServerStorage();holding++;intent=action;let result:T;try{result=await fn()}finally{holding--}await flushServerStorage();return result;}catch(e){if(!failed){pending.clear();values.clear();for(const [k,v]of acknowledged)values.set(k,v);resets.forEach(fn=>fn())}throw e}finally{intent=undefined;commands--;emit()}});commandQueue=task.catch(()=>{});return task}
export function unsavedServerData(){const all=new Map((failed?.documents??[]).map(d=>[d.key,{key:d.key,payload:d.payload}]));for(const [key,value]of pending)all.set(key,{key,payload:value?JSON.parse(value):null});return [...all.values()]}
function fallback():Storage{if(typeof window!=="undefined")throw new Error("서버 저장소를 먼저 불러와 주세요.");return localStorage}
export const businessStorage={getItem(key:string){if(runtimeScope())return runtimeScope()!.documents.get(key)??null;return installed?values.get(key)??null:fallback().getItem(key)},setItem(key:string,value:string){if(!installed){fallback().setItem(key,value);return}if(values.get(key)===value)return;values.set(key,value);if(key.startsWith("intentbridge:campaign-handoff:"))return;pending.set(key,value);emit();schedule()},removeItem(key:string){if(!installed){fallback().removeItem(key);return}values.delete(key);pending.set(key,null);emit();schedule()},key(index:number){return installed?[...values.keys()][index]??null:fallback().key(index)},get length(){return installed?values.size:fallback().length}};

export const serverStorageInstalled=()=>installed;
