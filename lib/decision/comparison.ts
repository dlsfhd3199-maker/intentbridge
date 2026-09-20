import type {Period} from "../../types/domain";
export function offsetDate(day:string,days:number){const date=new Date(day+"T00:00:00Z");date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
export function comparisonPeriod(end:string,period:Period){return {current:{start:offsetDate(end,1-period),end},previous:{start:offsetDate(end,1-period*2),end:offsetDate(end,-period)}}}
export const relativeChange=(now:number|null,previous:number|null)=>now===null||previous===null||previous===0?null:(now/previous-1)*100;
