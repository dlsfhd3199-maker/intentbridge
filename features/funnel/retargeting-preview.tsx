"use client";

import { useEffect, useRef } from "react";
import { ShieldCheck, X } from "lucide-react";
import type { AudienceSegment } from "@/types/funnel";
import type { Period } from "@/types/domain";
import { previewRetargeting } from "@/lib/funnel";
import { number, percent, won } from "@/lib/format";

export function RetargetingPreview({ segment, retargetName, period, onClose }: { segment: AudienceSegment; retargetName: string; period: Period; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const result = previewRetargeting(segment, retargetName, period);
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = oldOverflow; previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialog} className="fw-preview" aria-labelledby="preview-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className="fw-preview-body"><div className="fw-section-heading"><span className="fw-badge">{result.label}</span><button autoFocus className="fw-close" aria-label="미리보기 닫기" onClick={onClose}><X size={20}/></button></div><h2 id="preview-title">재공략 실행안 미리보기</h2><p className="fw-description">{retargetName} · {segment.name}</p><div className="fw-preview-stats"><div><span>대상 고객 / 예상 고객 그룹</span><strong>{number(result.audience)}명</strong></div><div><span>추천 리타겟팅 기간</span><strong>{result.window}일</strong></div></div><div className="fw-ad-copy"><span>광고 메시지 제안</span><p>{result.message}</p><span className="fw-cta-preview">추천 CTA · {result.cta}</span></div><div className="fw-preview-stats"><div><span>DEMO FORECAST · 예상 구매</span><strong>{number(result.forecastPurchases)}건</strong></div><div><span>DEMO FORECAST · 예상 CPA</span><strong>{result.forecastCpa === null ? "산출 불가" : won(result.forecastCpa)}</strong></div></div><div className="fw-forecast-method"><b>Mock Rule 기반 계산</b><p>대상 인원 × 가정 전환율 {percent(segment.forecastRate * 100)} → 예상 구매 (반올림)</p><p>대상 인원 × 인당 가정 광고비 {won(segment.costPerPerson)} → 가정 예산 {won(result.forecastSpend)}</p><p>예상 CPA = 가정 예산 ÷ 예상 구매. 예상 구매가 0이면 산출하지 않습니다.</p></div><p className="fw-exclusion"><ShieldCheck size={16}/> Purchase 제외된 세그먼트만 사용</p><p className="fw-note">실제 성과 예측 AI가 아닌 규칙 기반 성과 예측입니다. 성과를 보장하지 않으며 실제 광고·고객 그룹을 전송하지 않습니다.</p><button className="fw-primary fw-preview-done" onClick={onClose}>확인하고 닫기</button></div></dialog>;
}
