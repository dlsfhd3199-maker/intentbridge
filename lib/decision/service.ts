import type {Period} from "../../types/domain";
import type {CampaignHandoff,CampaignOrigin,CampaignWorkspace} from "../../types/campaign";
import type {Signal,SignalStatus} from "../../types/decision";
import {assertAccess} from "../permissions";
import {readGA4} from "../ga4/browser-service";
import {atomicStoreChange,mergeServerStorage} from "../server-storage";
import {readOperations,writeOperations} from "../operations-store";
import {evaluateCampaign,newCampaignDraft} from "../campaign-service";
import {normalizeDemo} from "./demo-normalizer";
import {generateSignals} from "./engine";
import {statusNames} from "./thresholds";
import {thresholds} from "./thresholds";
import type {PlatformView} from "../../types/platform";
import {readCampaignStore} from "../campaign-store";

export interface DecisionWorkspace {advertiserId:string;signals:Signal[];states:Record<string,SignalStatus>;context:CampaignWorkspace|null;note:string;draftCounts?:Record<string,number>}
export const validSignalStatus=(value:unknown):value is SignalStatus=>typeof value==="string"&&Object.hasOwn(statusNames,value);
export function readSignalStates(id:string){return readOperations(id).signalStates??{}}
export async function setSignalStatus(id:string,signalId:string,status:SignalStatus){
  assertAccess(id,"MANAGE_OPERATIONS");
  if(!validSignalStatus(status)||!signalId.startsWith(`decision:${id}:`)||signalId.length>240)throw new Error("신호 상태를 확인해 주세요.");
  await atomicStoreChange(()=>{const store=readOperations(id);writeOperations(id,{...store,signalStates:{...store.signalStates,[signalId]:status}})});
}
export async function loadDecisionWorkspace(advertiserId:string,period:Period):Promise<DecisionWorkspace>{
  assertAccess(advertiserId);
  // Existing guarded read endpoints: no external provider snapshot/test call, no new auth boundary.
  const [status,platform]=await Promise.all([readGA4({advertiserId,period},undefined,"status"),fetch(`/api/workspaces/${encodeURIComponent(advertiserId)}/platform`,{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("연결 상태 조회 실패");return await r.json() as PlatformView})]);
  await atomicStoreChange(async()=>{const r=await fetch(`/api/workspace-documents?advertiser=${encodeURIComponent(advertiserId)}`,{cache:"no-store"});if(!r.ok)throw new Error("신호 검토 상태 조회 실패");mergeServerStorage(await r.json())});
  if(status.mode==="real"||status.error){
    const signals=generateSignals({advertiserId,advertiserName:advertiserId,period,endDate:new Date().toISOString().slice(0,10),observedAt:new Date().toISOString(),source:status.mode==="real"?"REAL":"DEMO",sourceDescription:"연결 상태 메타데이터 · 비교 입력 미제공",current:null,previous:null,audiences:[],campaigns:[],health:{status:"missing",lastSync:null,reason:status.error?"연결 상태를 확인하지 못했습니다. 성과 판단을 보류합니다.":"실측 순차 여정·직전 기간 비교 입력이 아직 제공되지 않습니다. Demo 성과로 대체하지 않습니다."}});
    return {advertiserId,signals,states:readSignalStates(advertiserId),context:null,note:"실측 비교 데이터 준비 필요"};
  }
  const {input,context}=await normalizeDemo(advertiserId,period);
  const connections=Object.values(platform.document.connections);
  const issue=connections.find(c=>c.state==="error"||c.state==="attention");
  if(issue)input.health={status:"error",lastSync:issue.lastSync,reason:"데이터 연결에 오류 또는 확인할 항목이 있습니다. 연결 상태를 먼저 확인하세요."};
  else if(!platform.hasData)input.health={status:"missing",lastSync:null,reason:"수집 데이터가 없습니다. 데이터 연결과 수집 설정을 확인하세요."};
  else {const stale=connections.find(c=>c.state==="healthy"&&c.lastSync&&Date.now()-Date.parse(c.lastSync)>=thresholds.staleHours*3600000);if(stale)input.health={status:"error",lastSync:stale.lastSync,reason:`연결된 데이터가 ${thresholds.staleHours}시간 이상 갱신되지 않았습니다.`};}
  const store=readCampaignStore(advertiserId),draftCounts:Record<string,number>={};
  for(const draft of new Map([...store.drafts,...store.campaigns.filter(c=>c.status==="DRAFT")].map(d=>[d.draftId,d])).values()){const id=draft.origin.recommendation?.id;if(id?.startsWith("decision:"))draftCounts[id]=(draftCounts[id]??0)+1;}
  return {advertiserId,signals:generateSignals(input),states:readSignalStates(advertiserId),context,note:input.sourceDescription+` · 데이터 기준 ${input.endDate}`,draftCounts};
}
export function signalOrigin(signal:Signal):CampaignOrigin{
  if(!signal.audience)throw new Error("이 신호에 연결된 고객 그룹이 없습니다.");
  const a=signal.audience;
  return {from:"Funnel Workspace",recommendation:{id:signal.id,title:signal.title,priority:Math.round(signal.priority),message:`${signal.summary} | ${a.name} ${a.size}명 · ${a.window}일 · 구매 제외 | ${signal.sourceDescription} | ${signal.evidence.map(e=>`${e.label}: 현재 ${e.current??"—"}${e.unit}, 직전 ${e.previous??"미제공"}, 변화 ${e.change?.toFixed(1)??"미제공"}${e.changeUnit}`).join("; ")}`},recommendedBudgetChange:0,segmentId:a.segmentId,window:a.window,createdAt:signal.createdAt};
}
export function signalPreview(signal:Signal,context:CampaignWorkspace){
  assertAccess(signal.advertiserId,"MANAGE_CAMPAIGN");
  if(context.advertiser.id!==signal.advertiserId||context.baseline.period!==signal.period)throw new Error("고객 그룹의 광고주와 기간을 확인하세요.");
  const draft=newCampaignDraft(context,signalOrigin(signal),signal.audience!.sourceIds),evaluation=evaluateCampaign(draft,context);
  if(evaluation.audience!==signal.audience!.size)throw new Error("고객 그룹이 변경되었습니다. 신호를 다시 확인해 주세요.");
  return {draft,evaluation};
}
export function signalHandoff(signal:Signal,context:CampaignWorkspace):CampaignHandoff{
  const {draft}=signalPreview(signal,context);
  return {id:crypto.randomUUID(),advertiserId:signal.advertiserId,period:signal.period,sourceChannelId:draft.sourceChannelId,retargetingChannelId:draft.retargetingChannelId,sourceIds:draft.sourceIds,origin:draft.origin};
}
export const signalJourneyUrl=(s:Signal)=>`/funnel?${new URLSearchParams({advertiser:s.advertiserId,period:String(s.period),...(s.stage?{signalStage:s.stage}:{})})}`;
