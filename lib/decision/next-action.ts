import type {Signal} from "../../types/decision";
import {signalJourneyUrl} from "./service";
export function nextAction(signal:Signal){
 const query=new URLSearchParams({advertiser:signal.advertiserId,period:String(signal.period)});
 switch(signal.type){
  case "DROP_OFF":return {label:"고객 여정 확인",href:signalJourneyUrl(signal),plan:!!signal.audience&&signal.audience.size>0};
  case "RECOVERY_OPPORTUNITY":return {label:"고객 조건 확인",href:signalJourneyUrl(signal),plan:!!signal.audience&&signal.audience.size>0};
  case "PERFORMANCE_DROP":return {label:"성과 원인 확인",href:`/performance?${query}`,plan:false};
  case "CAMPAIGN_FATIGUE":return {label:"소재·노출 빈도 검토",href:`/campaigns?${query}`,plan:false};
  case "DATA_ISSUE":return {label:"데이터 연결 확인",href:`/connections?${query}`,plan:false};
  case "POSITIVE_MOMENTUM":return {label:"유지·확대 시뮬레이션 검토",href:`/performance?${query}`,plan:false};
 }
}
