"use client";
import {ForecastComparison,DataSourceBadge} from "@/components/product-ui";
import {useUserRole} from "@/context/user-role-context";
import {can} from "@/lib/permissions";
import {AdvertiserDashboard} from "@/features/dashboard/advertiser-dashboard";
import {useGA4} from "@/features/ga4/provider";
import {GA4AnalyticsView} from "@/features/ga4/analytics-view";
import { readSimulationLibrary, saveNamedSimulation } from "@/lib/simulation-library";
import { advertisers } from "@/lib/dashboard";
import type { SavedSimulation } from "@/types/operations";
import type { Period } from "@/types/domain";
import "@/features/operations/operations.css";
import { useRouter } from "next/navigation";
import { performanceHandoff } from "@/lib/campaign-service";
import { saveCampaignHandoff } from "@/lib/campaign-store";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FlaskConical, RotateCcw } from "lucide-react";
import { useDashboard, useWorkspaceSelection } from "@/components/app-shell";
import { loadPerformanceBaseline } from "@/lib/simulation/baseline";
import { compareMetrics, diagnose, normalizeLevers, simulate, waterfallBars } from "@/lib/simulation";
import { getRecommendations } from "@/lib/recommendations";
import { identifyScenario, restoreSetting, saveSetting } from "@/lib/simulation/store";
import { leverDefinitions, scenarios, whatIfPresets, zeroLevers } from "@/data/mock/simulation-config";
import type { BaselineMetrics, SimulationLevers } from "@/types/simulation";
import { number, percent, won } from "@/lib/format";
import { formatChange, formatMetric, leverValue, signed } from "./format";
import { SimulationCharts } from "./simulation-charts";
import "./performance.css";

function MockPerformanceLab() {
  const dashboard = useDashboard(), select = useWorkspaceSelection();
  const boot = useRef(false), incoming = useRef<SavedSimulation | null>(null);
  const [baseline, setBaseline] = useState<BaselineMetrics | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const advertiserId = dashboard.advertiser.id, period = dashboard.period;
  useEffect(() => {
    if (!boot.current) { const p = new URLSearchParams(window.location.search), id = p.get("advertiser"), simulationId = p.get("simulation"); if (id && simulationId && advertisers.some(a => a.id === id)) incoming.current = readSimulationLibrary(id).find(s => s.id === simulationId) ?? null; const s = incoming.current; if (s && (s.advertiserId !== advertiserId || s.period !== period)) { select(s.advertiserId, s.period as Period); return; } boot.current = true; }
    let active = true;
    setError(false);
    loadPerformanceBaseline({ advertiserId, period }).then(value => { if (active) { if (incoming.current) { saveSetting(value, incoming.current.levers); incoming.current = null; window.history.replaceState(null, "", "/performance"); } setBaseline(value); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [advertiserId, period, attempt]);
  if (error) return <div role="alert" className="pl-state">성과 데이터를 불러오지 못했습니다. <button onClick={() => setAttempt(value => value + 1)}>다시 시도</button></div>;
  if (!baseline || baseline.advertiserId !== advertiserId || baseline.period !== period) return <div className="pl-state" role="status">현재 성과를 분석하는 중입니다.</div>;
  return <LabContent key={`${advertiserId}:${period}`} baseline={baseline}/>;
}

function LabContent({ baseline: b }: { baseline: BaselineMetrics }) {
  const router = useRouter();
  const [levers, setLevers] = useState(() => restoreSetting(b));
  const [saveMode, setSaveMode] = useState<"local" | "memory">("memory");
  const [announcement, setAnnouncement] = useState("");
  const [simulationName, setSimulationName] = useState("");
  const forecast = useMemo(() => simulate(b, levers), [b, levers]);
  const diagnoses = useMemo(() => diagnose(b), [b]);
  const recommendations = useMemo(() => getRecommendations(b, forecast), [b, forecast]);
  const comparisons = useMemo(() => compareMetrics(b, forecast), [b, forecast]);
  const scenarioId = identifyScenario(levers);
  const scenarioName = scenarios.find(scenario => scenario.id === scenarioId)?.name ?? (scenarioId === "baseline" ? "변경 없음" : "사용자 정의");
  const scenarioRows = useMemo(() => scenarios.map(scenario => ({ ...scenario, result: simulate(b, scenario.levers) })), [b]);
  useEffect(() => { setSaveMode(saveSetting(b, levers)); }, [b, levers]);
  const apply = (changes: Partial<SimulationLevers>, message: string) => { setLevers(current => normalizeLevers({ ...current, ...changes })); setAnnouncement(message); };
  const baselineCards = [
    { label: "총 광고비", value: won(b.adSpend) }, { label: `${b.sourceChannel.name} 유입`, value: `${number(b.visitors)}명` },
    { label: "총 구매", value: `${number(b.totalPurchases)}건` }, { label: "총 매출", value: won(b.revenue) },
    { label: "통합 CPA", value: formatMetric(b.cpa, "money") }, { label: "통합 ROAS", value: formatMetric(b.roas, "percent") },
  ];
  return <div className="pl">
    <section className="pl-intro"><div className="pl-intro-title"><FlaskConical size={26}/><div><h2>성장의 다음 가정을 실험하세요</h2><p>{b.advertiserName} · 최근 {b.period}일 · {b.sourceChannel.name} <ArrowRight size={13}/> {b.retargetingChannel.name}</p></div><span className="pl-tag">RULE-BASED SIMULATION</span></div><p className="pl-disclaimer">예상 성과는 현재 데이터를 기반으로 한 시뮬레이션이며 실제 성과를 보장하지 않습니다.</p></section>
    <div className="pl-heading"><div><span className="pl-eyebrow">01 / BASELINE</span><h2>현재 성과를 출발점으로</h2></div><span className="pl-current-tag">CURRENT · MOCK DATA</span></div>
    <section className="ui-performance-top"><DataSourceBadge kind="forecast"/><div className="ui-forecast-pair"><ForecastComparison label="구매" current={b.totalPurchases} forecast={forecast.totalPurchases}/><ForecastComparison label="매출" current={b.revenue} forecast={forecast.revenue} money/></div></section><section className="pl-baseline" aria-label="핵심 성과 지표">{baselineCards.map(card => <div key={card.label}><span>{card.label}</span><strong>{card.value}</strong></div>)}</section>
    <div className="pl-baseline-split"><span>직접 구매 <b>{number(b.directPurchases)}건</b></span><span>+ {b.retargetingChannel.name} 추가 구매 <b>{number(b.metaPurchases)}건</b></span><span>현재 미구매 재공략 가능 <b>{number(b.currentAudience)}명</b></span></div>
    <section className="pl-panel" aria-labelledby="diagnosis-title"><div className="pl-heading"><div><span className="pl-eyebrow">02 / DIAGNOSIS</span><h2 id="diagnosis-title">어디에서 고객을 놓치고 있나요?</h2></div><span className="pl-muted">Mock 목표 대비 진단</span></div><div className="pl-table-scroll" tabIndex={0} role="region" aria-label="병목 진단 표"><table><thead><tr><th>퍼널 단계</th><th>현재 / 목표</th><th>이탈 고객</th><th>개선 여지</th><th>Severity</th></tr></thead><tbody>{diagnoses.map(item => <tr key={item.id}><th><b>{item.label}</b><small>{item.message}</small></th><td>{item.currentRate === null ? "—" : percent(item.currentRate)} <small>/ {item.benchmark}%</small></td><td>{number(item.dropOff)}명</td><td>+{number(item.opportunity)}명</td><td><span className={`pl-severity ${item.severity.toLowerCase()}`}>{item.currentRate === null ? "데이터 없음" : item.severity}</span></td></tr>)}</tbody></table></div><p className="pl-note">Funnel의 병목은 선택 소스의 최저 전환율이며, 이 화면은 전체 소스를 Mock 목표 대비로 진단합니다. 추천은 목표 미달 비율과 현재 시나리오의 효율 악화를 우선하므로 순서가 다를 수 있습니다. 목표는 업계 평균이 아닌 Mock 가정입니다. 개선 여지는 해당 단계에서만 목표에 도달할 때의 인원 차이이며 구매 증가 예측이 아닙니다. 재공략 풀은 현재 대상 {number(b.currentAudience)}명 + 회수 구매 {number(b.metaPurchases)}건 = {number(b.recoveryPool)}명의 합성 코호트입니다.</p></section>
    <section className="pl-simulation" aria-labelledby="simulation-title"><div className="pl-heading"><div><span className="pl-eyebrow">03 / SIMULATION</span><h2 id="simulation-title">변수를 바꾸고, 결과를 비교하세요</h2></div><button className="pl-reset" onClick={() => { setLevers({ ...zeroLevers }); setAnnouncement("모든 개선 가정을 0%로 초기화했습니다."); }}><RotateCcw size={15}/> Reset</button></div>
      <div className="pl-scenarios" role="group" aria-label="시나리오 선택">{scenarios.map(scenario => <button key={scenario.id} aria-pressed={scenarioId === scenario.id} onClick={() => { setLevers({ ...scenario.levers }); setAnnouncement(`${scenario.name} 시나리오를 적용했습니다.`); }}><b>{scenario.id==="aggressive"?"적극적":scenario.name}</b><span>{scenario.englishName}</span></button>)}</div>
      <div className="pl-simulator-grid"><details className="ui-advanced"><summary>상세 조정 <span>전환율 · 재공략 효율 · 예산</span></summary><div className="pl-levers">{leverDefinitions.map(definition => <div className="pl-lever" key={definition.id}><div><label htmlFor={`lever-${definition.id}`}>{definition.label}</label><span>{leverValue(levers[definition.id])}</span></div><p>{definition.help}</p><div className="pl-lever-controls"><input id={`lever-${definition.id}`} type="range" min={definition.min} max={definition.max} step={1} value={levers[definition.id]} onChange={event => apply({ [definition.id]: Number(event.target.value) }, "개선 가정을 변경했습니다.")}/><input aria-label={`${definition.label} 값`} type="number" min={definition.min} max={definition.max} value={levers[definition.id]} onChange={event => apply({ [definition.id]: Number(event.target.value) }, "개선 가정을 변경했습니다.")}/></div><div className="pl-range-labels"><span>{leverValue(definition.min)}</span><span>{leverValue(definition.max)}</span></div></div>)}</div>
        </details><div className="pl-forecast" aria-live="polite"><span className="pl-tag">DEMO FORECAST</span><h3>{scenarioName} 시나리오</h3><div className="pl-forecast-hero"><span>예상 총 구매</span><strong data-testid="projected-purchases">{number(forecast.totalPurchases)}<small>건</small></strong><span className={`pl-change ${comparisons[0].direction}`}>{formatChange(comparisons[0])} · Current 대비</span></div><div className="pl-forecast-stats">{comparisons.slice(1).map(row => <div key={row.id}><span>예상 {row.label}</span><b>{formatMetric(row.forecast, row.format)}</b><small className={`pl-change ${row.direction}`}>{formatChange(row)}</small></div>)}</div><div className="pl-confidence"><span>예상 정확도</span><b className={forecast.confidence.level.toLowerCase()} data-testid="confidence">{forecast.confidence.level}</b><p>{forecast.confidence.explanation}</p></div><p className="pl-note">기존 성과와 동일한 기간의 가정 비교입니다. 미래 특정 날짜의 실제 실적이 아닙니다.</p></div>
      </div><div className="pl-whatif"><div><b>What if…</b><span>이 조건만 바꾸면 어떨까요?</span></div><div role="group" aria-label="What-if">{whatIfPresets.map(preset => <button key={preset.id} onClick={() => apply(preset.changes, `${preset.label} 가정을 적용했습니다.`)}>{preset.label}</button>)}</div><p>선택한 항목을 해당 값으로 설정하며, 다른 레버는 유지합니다. Total Budget은 두 예산을 각각 +20%로 설정합니다.</p></div>
      <p className="pl-save-note">{saveMode === "local" ? "광고주·기간별 설정과 Forecast의 서버 저장을 요청했습니다." : "브라우저 저장소를 사용할 수 없어 현재 세션 메모리에 보관합니다."}</p><div role="status" className="pl-action-status">{announcement || "슬라이더를 움직여 가정을 비교해 보세요."}</div>
    </section>
    <div className="simulation-save"><label htmlFor="simulation-name">성과 예측 이름</label><input id="simulation-name" maxLength={120} placeholder="예: Meta Recovery Focus" value={simulationName} onChange={e => setSimulationName(e.target.value)}/><button onClick={() => { try { saveNamedSimulation(b, levers, simulationName); setAnnouncement("Simulation Library에 저장했습니다."); } catch (e) { setAnnouncement((e as Error).message); } }}>Library에 저장</button><Link href={`/operations?advertiser=${b.advertiserId}&period=${b.period}`}>성과 예측 Library 열기 →</Link></div>
    <section className="pl-panel"><div className="pl-heading"><div><span className="pl-eyebrow">COMPARE / DEMO FORECAST</span><h2>Current vs 예상 성과</h2></div><span className="pl-tag">성과 예측</span></div><div className="pl-table-scroll" tabIndex={0} role="region" aria-label="현재 대비 예상 성과"><table><thead><tr><th>Metric</th><th>Current</th><th>예상 성과</th><th>Change</th></tr></thead><tbody>{comparisons.map(row => <tr key={row.id}><th>{row.label}</th><td>{formatMetric(row.current, row.format)}</td><td className="pl-violet">{formatMetric(row.forecast, row.format)}</td><td className={`pl-change ${row.direction}`}>{formatChange(row)} {row.direction === "worse" ? "· 악화" : row.direction === "better" ? "· 개선" : ""}</td></tr>)}</tbody></table></div></section>
    <SimulationCharts baseline={b} forecast={forecast}/>
    <section className="pl-panel"><div className="pl-heading"><div><span className="pl-eyebrow">PURCHASE BREAKDOWN</span><h2>예상 구매 변화는 어디에서 생길까요?</h2></div><span className="pl-tag">DEMO FORECAST</span></div><div className="pl-breakdown">{waterfallBars(b, forecast).map(step => <div key={step.id} className={step.total ? `pl-breakdown-total ${step.id === "projected" ? "forecast" : ""}` : step.delta < 0 ? "negative" : step.delta > 0 ? "positive" : ""}><span>{step.label}</span><div className="pl-waterfall-track" aria-hidden="true"><i style={{ bottom: `${step.bottom}%`, height: `${step.height}%` }}/></div><b>{step.total ? number(step.cumulative) : signed(step.delta)}</b>{!step.total && <small>누적 {number(step.cumulative)}건</small>}</div>)}</div><p className="pl-note">Landing → 장바구니 → 결제 완료 → 재공략 효율 → 예산 순서로 하나씩 적용한 차이입니다. 상호작용과 반올림을 포함하며 인과적 기여도 추정은 아닙니다.</p></section>
    <section className="pl-panel"><div className="pl-heading"><div><span className="pl-eyebrow">SCENARIO COMPARISON</span><h2>세 가지 가정을 같은 기준으로</h2></div><span className="pl-tag">DEMO FORECAST</span></div><div className="pl-table-scroll" tabIndex={0} role="region" aria-label="시나리오 비교"><table><thead><tr><th>시나리오</th><th>예상 구매</th><th>예상 매출</th><th>예상 광고비</th><th>예상 CPA</th><th>예상 ROAS</th><th>Confidence</th></tr></thead><tbody>{scenarioRows.map(row => <tr key={row.id}><th>{row.id==="aggressive"?"적극적":row.name}</th><td>{number(row.result.totalPurchases)}건</td><td>{won(row.result.revenue)}</td><td>{won(row.result.adSpend)}</td><td>{formatMetric(row.result.cpa, "money")}</td><td>{formatMetric(row.result.roas, "percent")}</td><td>{row.result.confidence.level}</td></tr>)}</tbody></table></div></section>
    <section className="pl-panel"><div className="pl-heading"><div><span className="pl-eyebrow">04 / AI OPERATIONS · RULE-BASED</span><h2>다음 실험을 위한 운영 추천</h2></div></div><p className="pl-note">외부 AI 호출 없이 현재 퍼널·비용·변경 가정을 분석한 규칙 기반 추천입니다. 적용은 성과 예측에만 반영됩니다.</p><div className="pl-recommendations">{recommendations.map(recommendation => <article key={recommendation.id}><span className="pl-priority">PRIORITY {recommendation.priority}</span><h3>{recommendation.title}</h3><p>{recommendation.message}</p><span className="pl-recommend-action">{recommendation.actionLabel}</span><button onClick={() => apply(recommendation.changes, `${recommendation.title} 추천을 적용했습니다.`)}>시뮬레이션에 적용 <ArrowRight size={15}/></button><button onClick={() => router.push(saveCampaignHandoff(performanceHandoff(b, levers, recommendation)))}>캠페인 만들기 <ArrowRight size={15}/></button></article>)}</div></section>
    <details className="pl-method"><summary>성과 예측 계산 가정과 데이터 기준</summary><p>기존 Mock 합계를 사용합니다. 7·14일은 기존 비례 예시 데이터이며 실제 일자별 이력이 아닙니다. 레버의 +10%는 10%p 증가가 아닌 기존 전환율의 1.1배입니다.</p><p>유입 예산은 Paid 유입에 비례하고 Organic은 고정됩니다. Landing·Cart·Checkout 레버는 해당 전환율에 순차 적용합니다. 전환율은 100%, 각 단계 인원은 상위 단계 수를 넘지 않게 제한합니다.</p><p>직접 구매하지 않은 고객에 기존 재공략 자격 비율을 적용한 뒤, 회수 전환율에 효율·재공략 예산 배수를 적용합니다. 가격은 직접·회수 경로별 평균 주문액으로 고정하고 광고비는 두 예산을 합산합니다. 예산에 대한 선형 반응과 고정 자격 비율은 단순 Mock 가정입니다.</p><p>가정 변경 폭에 따른 Confidence는 통계적 신뢰도가 아닙니다. 0건 구매의 CPA와 0원 광고비의 ROAS는 산출 불가입니다. 저장된 예상 성과는 화면 복원 시 현재 현재 성과으로 다시 계산합니다.</p></details>
    <Link href="/dashboard" className="pl-back"><ArrowLeft size={16}/> 홈 대시보드로 돌아가기</Link>
  </div>;
}

export function PerformanceLab(){const {user}=useUserRole(),{mode}=useGA4();if(!can(user.role,"MANAGE_CAMPAIGN"))return <AdvertiserDashboard view="performance"/>;return mode==="real"?<GA4AnalyticsView page="performance"/>:<MockPerformanceLab/>;}
