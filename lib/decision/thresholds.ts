export const thresholds = {
  drop:{watch:3,action:7}, performance:{watch:10,action:20}, positive:10,
  recovery:{minimum:30,action:100}, fatigue:{frequencyGrowth:15,responseDrop:10},
  staleHours:24, sample:{minimum:30,high:500}, highPeriod:30,
  priority:{severity:{INFO:100,WATCH:200,ACTION:300,CRITICAL:400},confidence:{LOW:0,MEDIUM:10,HIGH:20},impactCap:20,revenueCap:15,magnitudeCap:15},
} as const;
export const signalNames = {DROP_OFF:"이탈 증가",PERFORMANCE_DROP:"성과 하락",RECOVERY_OPPORTUNITY:"재공략 기회",CAMPAIGN_FATIGUE:"소재 피로",DATA_ISSUE:"데이터 확인",POSITIVE_MOMENTUM:"성과 상승"} as const;
export const severityNames = {INFO:"참고",WATCH:"확인 필요",ACTION:"조치 필요",CRITICAL:"긴급 확인"} as const;
export const statusNames = {NEW:"새 신호",REVIEWING:"검토 중",ACTIONED:"대응 완료",DISMISSED:"숨김"} as const;
export const ruleDescriptions = [
  `이탈 증가: 직전 동일 기간 대비 단계 전환율 ${thresholds.drop.watch}%p 하락 시 확인, ${thresholds.drop.action}%p 하락 시 조치. 양 기간 이전 단계 ${thresholds.sample.minimum}명 이상.`,
  `성과 하락: 구매·매출·ROAS 하락 또는 CPA 상승 ${thresholds.performance.watch}% 이상 확인, ${thresholds.performance.action}% 이상 조치. 같은 기간 KPI는 한 신호로 통합.`,
  `재공략: 구매 제외·재공략 가능·가장 깊은 행동 기준 그룹 ${thresholds.recovery.minimum}명 이상. ${thresholds.recovery.action}명 이상이면 조치 권장.`,
  `소재 피로: 빈도 ${thresholds.fatigue.frequencyGrowth}% 이상 증가와 CTR 또는 CVR ${thresholds.fatigue.responseDrop}% 이상 하락이 함께 발생.`,
  `데이터 확인: 연결 오류·데이터 없음·${thresholds.staleHours}시간 이상 동기화 지연 시 성과와 Audience 제안 중지.`,
  `성과 상승: 구매·매출·ROAS 상승 또는 CPA 개선 ${thresholds.positive}% 이상. 하락 신호와 동시에 예산 확대를 제안하지 않음.`,
];
