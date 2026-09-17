import type { ActionKind, CampaignTarget, Guardrail, OperationMetric } from "../../types/operations";
export const defaultTarget: CampaignTarget = { cpa:25000,roas:400 };
export const defaultGuardrail: Guardrail = { minDaily:1000,maxDaily:100000,maxIncrease:20,minAudience:100,maxFrequency:5 };
export const operationMetrics: {id:OperationMetric;label:string;unit:string}[] = [
  {id:"roas",label:"ROAS",unit:"%"},{id:"cpa",label:"CPA",unit:"원"},{id:"ctr",label:"CTR",unit:"%"},{id:"cvr",label:"CVR",unit:"%"},{id:"frequency",label:"Frequency",unit:"회"},{id:"spend",label:"Spend",unit:"원"},{id:"purchases",label:"Purchases",unit:"건"},{id:"audienceRemaining",label:"Audience Remaining",unit:"%"},{id:"dailyBudgetUsage",label:"Daily Budget Usage",unit:"%"},
];
export const operationActions: ActionKind[] = ["Increase Budget","Decrease Budget","Pause","Resume","Creative Refresh","Audience Expand","Window Change","Notify Only"];
// Reproducible aggregate observations; no network or actual account performance.
export const monitoringProfiles = {
  "checkout-7d": {frequency:2.1,ctr:.055,cvr:.22,reachShare:.55},
  "cart-14d": {frequency:3.2,ctr:.025,cvr:.08,reachShare:.65},
  "view-30d": {frequency:5.2,ctr:.018,cvr:.04,reachShare:.75},
};
