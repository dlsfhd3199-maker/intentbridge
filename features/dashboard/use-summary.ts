"use client";
import {useEffect,useState} from "react";
import {useDashboard} from "@/components/app-shell";
import {loadWorkspaceSummary,type WorkspaceSummary} from "@/lib/workspace-summary";
export function useSummary(){const {advertiser,period}=useDashboard(),[state,setState]=useState<{data?:WorkspaceSummary;error?:string}>({});useEffect(()=>{let active=true;setState({});loadWorkspaceSummary({advertiserId:advertiser.id,period}).then(data=>{if(active)setState({data});}).catch(()=>{if(active)setState({error:"성과를 불러오지 못했습니다. 다시 접속해 주세요."});});return()=>{active=false};},[advertiser.id,period]);return state;}
