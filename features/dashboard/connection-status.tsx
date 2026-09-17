"use client";
import {useEffect,useState} from "react";
import {readGA4} from "@/lib/ga4/browser-service";
export function ConnectionStatus({advertiserId}:{advertiserId:string}){const [label,setLabel]=useState("확인 중");useEffect(()=>{let active=true;readGA4({advertiserId,period:30},undefined,"status").then(r=>{if(active)setLabel(`${r.mode==="mock"?"Mock":"GA4 Real"} · ${r.connection.status==="NOT CONFIGURED"?"GA4 미설정":r.connection.status==="CONNECTED"?"연결 확인됨":r.connection.status==="CONFIGURED"?"연결 검증 대기":"연결 확인 필요"}`);}).catch(()=>{if(active)setLabel("연결 상태 확인 필요");});return()=>{active=false};},[advertiserId]);return <p>데이터 연결 · {label}</p>;}
