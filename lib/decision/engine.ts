import type {DecisionInput,DecisionMetrics,Evidence,Signal,Severity,SignalType} from "../../types/decision";
import type {StageId} from "../../types/funnel";
import {relativeChange} from "./comparison";
import {thresholds as t} from "./thresholds";

const stages:StageId[]=["Visit","ViewContent","AddToCart","BeginCheckout","Purchase"];
const stageNames=["유입","상품조회","장바구니","결제 진입","직접 구매"];
export function confidence(input:DecisionInput):Signal["confidence"]{
  const stale=input.health.lastSync!==null&&(Date.parse(input.observedAt)-Date.parse(input.health.lastSync))/3600000>=t.staleHours;
  if(input.health.status!=="healthy"||stale||!input.current||!input.previous||!validMetrics(input.current)||!validMetrics(input.previous)||input.current.stages.Visit<t.sample.minimum||input.previous.stages.Visit<t.sample.minimum)return "LOW";
  return input.period>=t.highPeriod&&Math.min(input.current.stages.Visit,input.previous.stages.Visit)>=t.sample.high?"HIGH":"MEDIUM";
}
// Fingerprint includes evidence and scope. Identical input retains the same persisted review state.
function fingerprint(value:unknown){let h=2166136261;for(const c of JSON.stringify(value))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h.toString(16)}
export function rankSignals(signals:Signal[]):Signal[]{return [...new Map(signals.map(s=>[s.id,s])).values()].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id,"en"))}
const financial=(m:DecisionMetrics)=>({purchases:m.purchases,revenue:m.revenue,cpa:m.purchases?m.spend/m.purchases:null,roas:m.spend?m.revenue/m.spend*100:null});
const validMetrics=(m:DecisionMetrics)=>[...Object.values(m.stages),m.purchases,m.revenue,m.spend].every(n=>Number.isFinite(n)&&n>=0)&&stages.every((s,i)=>!i||m.stages[s]<=m.stages[stages[i-1]]);
export function generateSignals(input:DecisionInput):Signal[]{
  const results:Signal[]=[],c=input.current,p=input.previous,level=confidence(input);
  const emit=(type:SignalType,severity:Severity,title:string,summary:string,evidence:Evidence[],affectedUsers:number,recommendedAction:string,stage:StageId|null=null,audience:Signal["audience"]=null,revenueImpact=0)=>{
    const magnitude=Math.max(0,...evidence.map(e=>Math.abs(e.change??0)));
    const priority=t.priority.severity[severity]+t.priority.confidence[level]+Math.min(t.priority.impactCap,Math.log10(affectedUsers+1)*5)+Math.min(t.priority.revenueCap,Math.log10(revenueImpact+1)*2)+Math.min(t.priority.magnitudeCap,magnitude/2);
    results.push({id:`decision:${input.advertiserId}:${input.period}:${type}:${fingerprint([input.endDate,type,title,evidence,audience])}`,advertiserId:input.advertiserId,advertiserName:input.advertiserName,type,severity,title,summary,evidence,affectedUsers,recommendedAction,stage,audience,revenueImpact,expectedResult:null,source:input.source,sourceDescription:input.sourceDescription,createdAt:input.observedAt,confidence:level,priority,period:input.period,endDate:input.endDate});
  };
  const sync=input.health.lastSync?Date.parse(input.health.lastSync):NaN,age=Number.isFinite(sync)?Math.max(0,(Date.parse(input.observedAt)-sync)/3600000):null;
  if(input.health.status!=="healthy"||!c||!validMetrics(c)||(p&&!validMetrics(p))||(age!==null&&age>=t.staleHours)){
    emit("DATA_ISSUE","CRITICAL","데이터를 먼저 확인해주세요.",input.health.reason??"연결 또는 수집 상태를 확인한 후 성과를 판단하세요.",[{label:"마지막 동기화 이후",current:age,previous:null,change:null,unit:"시간",changeUnit:"%",threshold:`연결 오류·데이터 없음 또는 ${t.staleHours}시간 이상 지연`}],0,"데이터 연결 확인");
    return results.map(s=>({...s,confidence:"LOW"}));
  }
  if(p){
    const drops=stages.slice(1).flatMap((stage,i)=>{
      const from=stages[i],a=c.stages[from],b=p.stages[from];if(Math.min(a,b)<t.sample.minimum)return [];
      const now=c.stages[stage]/a*100,prev=p.stages[stage]/b*100,delta=now-prev;
      return delta<=-t.drop.watch?[{stage,from,index:i,now,prev,delta,loss:a-c.stages[stage]}]:[];
    }).sort((a,b)=>a.delta-b.delta||a.index-b.index);
    // One journey signal: show the strongest degradation, rather than competing cards per step.
    if(drops[0]){const d=drops[0],a=input.audiences.find(a=>a.event===d.from)??null;
      emit("DROP_OFF",d.delta<=-t.drop.action?"ACTION":"WATCH",`${stageNames[d.index]} 이후 이탈이 증가했습니다.`,`${stageNames[d.index]} → ${stageNames[d.index+1]}의 전환율을 직전 동일 기간과 비교했습니다.`,[{label:`${stageNames[d.index]} → ${stageNames[d.index+1]}`,current:d.now,previous:d.prev,change:d.delta,unit:"%",changeUnit:"%p",threshold:`하락 ${t.drop.watch}%p 확인 / ${t.drop.action}%p 조치`}],d.loss,"고객 흐름과 이탈 구간 확인",d.stage,a);
    }
    const a=financial(c),b=financial(p),labels={purchases:"총 구매",revenue:"매출",cpa:"CPA",roas:"ROAS"};
    const metrics=(Object.keys(a) as (keyof typeof a)[]).map(key=>({key,e:{label:labels[key],current:a[key],previous:b[key],change:relativeChange(a[key],b[key]),unit:(key==="purchases"?"건":key==="roas"?"%":"원") as Evidence["unit"],changeUnit:"%" as const,threshold:`악화 ${t.performance.watch}% 확인 / ${t.performance.action}% 조치; 개선 ${t.positive}%`} }));
    const adverse=metrics.filter(({key,e})=>e.change!==null&&(key==="cpa"?e.change:-e.change)>=t.performance.watch);
    const positive=metrics.filter(({key,e})=>e.change!==null&&(key==="cpa"?-e.change:e.change)>=t.positive);
    if(Math.min(c.stages.Visit,p.stages.Visit)>=t.sample.minimum){
      if(adverse.length)emit("PERFORMANCE_DROP",adverse.some(({e})=>Math.abs(e.change!)>=t.performance.action)?"ACTION":"WATCH","구매 성과가 하락했습니다.","구매·매출·효율의 악화를 하나의 신호로 묶었습니다.",adverse.map(m=>m.e),c.stages.Visit,"유입 구성과 구매 여정 점검",null,null,Math.max(0,p.revenue-c.revenue));
      else if(positive.length)emit("POSITIVE_MOMENTUM","INFO","성과가 개선되고 있습니다.","좋아진 고객 그룹과 운영 조건을 유지하고 재현 가능성을 확인하세요.",positive.map(m=>m.e),c.purchases,"성과 좋은 조건 유지 · 확대는 검토 후 결정",null,null,Math.max(0,c.revenue-p.revenue));
    }
  }
  for(const a of input.audiences.filter(a=>a.size>=t.recovery.minimum))emit("RECOVERY_OPPORTUNITY",a.size>=t.recovery.action?"ACTION":"WATCH",`${a.name} 고객에게 다시 연결할 기회입니다.`,`${a.window}일 내 ${a.event} · 구매 완료 제외 · 더 깊은 행동 그룹 중복 제외`,[{label:"재공략 가능 고객",current:a.size,previous:null,change:null,unit:"명",changeUnit:"%",threshold:`현재 모집단 ${t.recovery.minimum}명 이상 · 과거 고객 그룹 이력 미제공`}],a.size,"대상 고객 확인 후 캠페인 설계",a.event,a);
  for(const campaign of input.campaigns){const prev=campaign.previous,now=campaign.current;if(!prev)continue;
    const growth=relativeChange(now.frequency,prev.frequency),ctr=relativeChange(now.ctr,prev.ctr),cvr=relativeChange(now.cvr,prev.cvr);
    if(growth!==null&&growth>=t.fatigue.frequencyGrowth&&((ctr!==null&&ctr<=-t.fatigue.responseDrop)||(cvr!==null&&cvr<=-t.fatigue.responseDrop)))emit("CAMPAIGN_FATIGUE","WATCH",`${campaign.name}의 반복 노출 이후 반응이 둔화되었습니다.`,"빈도와 반응률이 함께 변한 경우만 표시합니다.",(["frequency","ctr","cvr"] as const).map(key=>({label: key==="frequency"?"Frequency":key.toUpperCase(),current:now[key],previous:prev[key],change:relativeChange(now[key],prev[key]),unit:key==="frequency"?"회":"%",changeUnit:"%",threshold:`빈도 +${t.fatigue.frequencyGrowth}% AND 반응 -${t.fatigue.responseDrop}%`})),campaign.audience,"소재·노출 제한을 검토하세요");
  }
  return rankSignals(results);
}
