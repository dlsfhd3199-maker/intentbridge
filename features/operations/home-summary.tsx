"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { loadOperations } from "@/lib/operations-engine";
import type { Period } from "@/types/domain";
export function OperationsSummary({advertiserId,period}:{advertiserId:string;period:Period}) {
  const [counts,setCounts]=useState([0,0,0]);
  useEffect(()=>{let active=true;loadOperations(advertiserId,period).then(w=>{if(active)setCounts([w.campaigns.filter(c=>c.campaign.status==="MOCK ACTIVE").length,w.campaigns.filter(c=>c.health==="ACTION REQUIRED").length,w.recommendations.filter(r=>r.status==="PENDING").length]);}).catch(()=>{if(active)setCounts([0,0,0]);});return()=>{active=false};},[advertiserId,period]);
  return <section className="operations-home"><div>{["Active Mock Campaigns","Action Required","Automation Suggestions"].map((label,i)=><span key={label}>{label}<b>{counts[i]}</b></span>)}</div><Link href={`/operations?advertiser=${advertiserId}&period=${period}`}>광고 운영 열기 →</Link></section>;
}
