"use client";
import {planStatus,originLabel,historyLabel} from "@/lib/product-language";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignDraft } from "@/types/campaign";
import type { SavedSimulation } from "@/types/operations";
import { readSimulationLibrary, duplicateSimulation, deleteSimulation } from "@/lib/simulation-library";
import { loadCampaignPlans } from "@/lib/campaign-library";
import { deleteDraft, duplicateDraft, readCampaignStore, saveCampaignHandoff } from "@/lib/campaign-store";
import { performanceHandoff } from "@/lib/campaign-service";
import { getRecommendations } from "@/lib/recommendations";
import { campaignPlan, downloadCampaignPlan } from "@/lib/export-service";
import { number, won } from "@/lib/format";
import "./operations.css";
const money=(n:number|null)=>n===null?"—":won(n),ratio=(n:number|null)=>n===null?"—":`${n.toFixed(1)}%`;
export function ExportButtons({campaign}:{campaign:Campaign}) {return <div className="op-actions" aria-label="실행안 내보내기">{(["json","csv","html"] as const).map(format=><button key={format} onClick={()=>downloadCampaignPlan(campaignPlan(campaign),format)}>{format.toUpperCase()} Export</button>)}</div>;}
export function VersionHistory({campaign}:{campaign:Campaign}) {
  const saved=readCampaignStore(campaign.advertiserId).versions.filter(v=>v.campaignId===campaign.id);
  const versions=saved.length?saved:[{id:campaign.id,version:1,createdAt:campaign.createdAt,reason:"최초 실행안",snapshot:campaign}];
  return <div className="op"><h3>실행안 버전 기록</h3><div className="op-scroll"><table><thead><tr><th>Version</th><th>설정</th><th>총 예산</th><th>변경 이유 / 시간</th></tr></thead><tbody>{versions.map((v,i)=><tr key={v.id}><th>v{v.version} {i===versions.length-1&&<span className="op-badge healthy">Current Version</span>}</th><td>{v.snapshot.window}D · {planStatus(v.snapshot.status)}</td><td>{won(v.snapshot.budget.total)}</td><td>{historyLabel(v.reason)}<small>{v.createdAt}</small></td></tr>)}</tbody></table></div></div>;
}
export function DraftLibrary({advertiserId,revision,onOpen,onDelete}:{advertiserId:string;revision?:string;onOpen?:(d:CampaignDraft)=>void;onDelete?:(id:string)=>void}) {
  const router=useRouter(),[plans,setPlans]=useState<Campaign[]>([]),[tick,setTick]=useState(0),[notice,setNotice]=useState("");
  useEffect(()=>{let active=true;loadCampaignPlans(advertiserId).then(p=>{if(active)setPlans(p.filter(c=>c.status==="DRAFT"));}).catch(()=>setNotice("초안을 불러오지 못했습니다."));return()=>{active=false};},[advertiserId,revision,tick]);
  const run=(fn:()=>void)=>{try{fn();setTick(t=>t+1);}catch(e){setNotice((e as Error).message);}};
  return <section className="op op-library"><h2>실행안 초안</h2><p>광고주별 여러 초안을 자동 저장합니다. 삭제하면 해당 초안만 제거됩니다.</p><div className="op-scroll"><table><thead><tr><th>Name / Origin</th><th>Created / Last Edited</th><th>예상 성과 ROAS</th><th>Status</th><th>작업</th></tr></thead><tbody>{plans.map(c=><tr key={c.draftId}><th>{c.name||"이름 없는 초안"}<small>{originLabel(c.origin.from)} · {c.period}일 분석</small></th><td>{c.createdAt.slice(0,16)}<small>{c.updatedAt.slice(0,16)}</small></td><td>{ratio(c.forecast.roas)}<small>DEMO FORECAST</small></td><td>초안</td><td><div className="op-actions"><button onClick={()=>onOpen?onOpen(c):router.push(`/campaigns?advertiser=${advertiserId}&period=${c.period}&draft=${c.draftId}`)}>열기</button><button onClick={()=>run(()=>{duplicateDraft(c);setNotice("초안을 복제했습니다.");})}>복제</button><button onClick={()=>run(()=>{deleteDraft(advertiserId,c.draftId);onDelete?.(c.draftId);setNotice("초안을 삭제했습니다.");})}>삭제</button></div></td></tr>)}</tbody></table></div>{!plans.length&&<p>저장된 초안이 없습니다.</p>}<p role="status">{notice}</p></section>;
}
export function SimulationLibrary({advertiserId}:{advertiserId:string}) {
  const router=useRouter(),[items,setItems]=useState<SavedSimulation[]>([]),[selected,setSelected]=useState<string[]>([]),[notice,setNotice]=useState("");
  useEffect(()=>{setItems(readSimulationLibrary(advertiserId));setSelected([]);},[advertiserId]);
  const refresh=()=>setItems(readSimulationLibrary(advertiserId));
  const chosen=items.filter(s=>selected.includes(s.id));
  return <section className="op-library"><h2>성과 예측 Library</h2><p>성과 개선에서 이름을 지정해 저장한 스냅샷입니다. 2~3개를 선택해 같은 기간·가정인지 확인하며 비교하세요.</p><div className="op-scroll"><table><thead><tr><th>비교</th><th>성과 예측 / Created</th><th>Purchase / Revenue</th><th>CPA / ROAS</th><th>Confidence</th><th>작업</th></tr></thead><tbody>{items.map(s=><tr key={s.id}><td><input aria-label={`${s.name} 비교`} type="checkbox" checked={selected.includes(s.id)} disabled={!selected.includes(s.id)&&selected.length>=3} onChange={e=>setSelected(e.target.checked?[...selected,s.id]:selected.filter(id=>id!==s.id))}/></td><th>{s.name}<small>{s.scenario} · {s.period}일 · {s.createdAt.slice(0,16)}</small></th><td>{number(s.forecast.totalPurchases)}건<small>{won(s.forecast.revenue)}</small></td><td>{money(s.forecast.cpa)}<small>{ratio(s.forecast.roas)}</small></td><td>{s.forecast.confidence.level}</td><td><div className="op-actions"><button onClick={()=>router.push(`/performance?advertiser=${advertiserId}&period=${s.period}&simulation=${s.id}`)}>성과 개선에서 열기</button><button onClick={()=>{const r=getRecommendations(s.baseline,s.forecast)[0];if(r)router.push(saveCampaignHandoff(performanceHandoff(s.baseline,s.levers,r)));}}>실행안 작성</button><button onClick={()=>{duplicateSimulation(advertiserId,s.id);refresh();setNotice("Simulation을 복제했습니다.");}}>복제</button><button onClick={()=>{deleteSimulation(advertiserId,s.id);setSelected(selected.filter(id=>id!==s.id));refresh();setNotice("Simulation을 삭제했습니다.");}}>삭제</button></div></td></tr>)}</tbody></table></div>{!items.length&&<p>성과 개선에서 성과 예측 이름을 입력하고 Library에 저장하세요.</p>}{chosen.length>=2&&<div className="op-scroll" aria-label="Simulation Compare"><h3>성과 예측 Compare · DEMO FORECAST</h3><table><thead><tr><th>Metric</th>{chosen.map(s=><th key={s.id}>{s.name} · {s.period}일</th>)}</tr></thead><tbody>{["Ad Spend","Purchases","Revenue","CPA","ROAS","Confidence"].map((label,i)=><tr key={label}><th>{label}</th>{chosen.map(s=><td key={s.id}>{[won(s.forecast.adSpend),number(s.forecast.totalPurchases),won(s.forecast.revenue),money(s.forecast.cpa),ratio(s.forecast.roas),s.forecast.confidence.level][i]}</td>)}</tr>)}</tbody></table></div>}<p role="status">{notice}</p></section>;
}
export function CampaignCompare({advertiserId,revision}:{advertiserId:string;revision:number}) {
  const [items,setItems]=useState<Campaign[]>([]),[selected,setSelected]=useState<string[]>([]);
  useEffect(()=>{let active=true;loadCampaignPlans(advertiserId).then(p=>{if(active)setItems(p);});setSelected([]);return()=>{active=false};},[advertiserId,revision]);
  const chosen=selected.map(id=>items.find(c=>c.id===id)).filter((c):c is Campaign=>!!c);
  return <section className="op-library"><h2>실행안 비교 · 내보내기</h2><p>초안 또는 실행안 2개를 선택하세요. 모든 예상값은 DEMO FORECAST입니다.</p><div className="op-fields">{[0,1].map(i=><label key={i}>비교 실행안 {i+1}<select value={selected[i]??""} onChange={e=>setSelected(i===0?[e.target.value,selected[1]??""]:[selected[0]??"",e.target.value])}><option value="">선택하세요</option>{items.map(c=><option key={c.id} value={c.id} disabled={selected[1-i]===c.id}>{c.name||"이름 없는 초안"} · {planStatus(c.status)}</option>)}</select></label>)}</div>{chosen.length===2&&<div className="op-scroll" aria-label="실행안 비교"><table><thead><tr><th>Metric</th>{chosen.map(c=><th key={c.id}>{c.name}</th>)}</tr></thead><tbody>{["Audience","Budget","Frequency","Forecast Purchase","Forecast CPA","Forecast ROAS"].map((label,i)=><tr key={label}><th>{label}</th>{chosen.map(c=><td key={c.id}>{[`${c.audienceName} · ${c.audienceSize}명 / ${c.window}D`,won(c.budget.total),c.frequency,number(c.forecast.purchases),money(c.forecast.cpa),ratio(c.forecast.roas)][i]}</td>)}</tr>)}</tbody></table></div>}{chosen.map(c=><div className="op-export" key={c.id}><b>{c.name}</b><ExportButtons campaign={c}/></div>)}</section>;
}
