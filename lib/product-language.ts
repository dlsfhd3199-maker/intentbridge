// Presentation only: persisted enums, permissions, routes and calculation contracts stay unchanged.
export const productDefinition="광고 성과와 고객 행동을 연결해, 무엇을 확인하고 어떻게 대응할지 보여주는 광고 운영 의사결정 플랫폼";
export const productFlow="DATA → SIGNAL → ANALYSIS → DECISION → ACTION PLAN → REPORT";
export const planCopy={name:"실행안",studio:"재공략 실행안",create:"실행안 작성",save:"실행안 저장",review:"검토 완료로 표시",hold:"보류로 표시",apply:"실행안에 반영",restore:"이전 실행안 복원",handoff:"실제 광고 집행은 마케터가 해당 광고 플랫폼에서 진행합니다. IntentBridge는 광고 생성·예산 변경·고객 전송을 수행하지 않습니다."} as const;
export const navigationCopy:Record<string,{name:string;caption:string}>={"/campaigns":{name:"실행안",caption:"Action Plans"},"/operations":{name:"운영 제안",caption:"Review"}};
const planStates:Record<string,string>={DRAFT:"초안",READY:"실행 준비", "MOCK ACTIVE":"검토 완료",PAUSED:"보류",ALL:"전체"};
export const planStatus=(state:string)=>planStates[state]??state;
const actions:Record<string,string>={"Increase Budget":"예산 확대 검토","Decrease Budget":"예산 축소 검토",Pause:"보류 검토",Resume:"재검토", "Creative Refresh":"메시지안 수정 검토","Audience Expand":"고객 조건 확대 검토","Window Change":"대상 기간 변경 검토","Notify Only":"확인 항목 기록"};
export const operationAction=(action:string)=>actions[action]??action;
const reviews:Record<string,string>={PENDING:"검토 대기","APPLIED IN MOCK":"실행안 반영 완료",IGNORED:"보류",ROLLBACK:"이전 실행안 복원",Budget:"예산안",Status:"검토 상태",Audience:"고객 조건",Creative:"메시지안",Window:"대상 기간",Notification:"확인 기록",All:"전체"};
export const reviewLabel=(value:string)=>reviews[value]??value;
export const originLabel=(value:string)=>({"Campaign Studio":"실행안 직접 작성","Funnel Workspace":"고객 여정","Performance Lab":"성과 시뮬레이션"})[value]??value;
export const activityLabel=(value:string)=>({"캠페인 저장":"실행안 저장","캠페인 초안 저장":"실행안 초안 저장","데모 운영 변경":"내부 실행안 변경","워크스페이스 운영 시작":"워크스페이스 분석 시작"})[value]??value;
export const surfaceLabel=(value:string)=>({"Campaign Studio":"재공략 실행안",Operations:"운영 제안",Audience:"대상 고객 조건","Campaign 설계안":"실행안","Mock 운영 상태":"실행안 검토 상태"})[value]??value;
// Translate known system-generated history suffixes, not arbitrary user names/content.
export function historyLabel(value:string){
 if(value==="기존 캠페인 보존")return "기존 실행안 보존";
 if(value==="Campaign Studio 변경")return "실행안 편집";
 if(value.startsWith("ROLLBACK · "))return `이전 실행안 복원 · ${originLabel(value.slice(11))}`;
 return value;
}
export function alertLabel(message:string){for(const [code,label] of Object.entries(actions)){const suffix=`: ${code} APPLIED IN MOCK`;if(message.endsWith(suffix))return `${message.slice(0,-suffix.length)}: ${label} · 실행안 반영 완료`;}return message;}
