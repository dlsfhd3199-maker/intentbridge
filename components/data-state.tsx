import Link from "next/link";
export function DataState({kind,message,href,action,onRetry}:{kind:"loading"|"empty"|"error"|"disconnected"|"permission";message?:string;href?:string;action?:string;onRetry?:()=>void}){
  const labels={loading:"데이터를 준비하고 있습니다.",empty:"아직 데이터가 없습니다.",error:"데이터를 불러오지 못했습니다.",disconnected:"아직 연결되지 않았습니다.",permission:"권한 준비가 필요합니다."};
  return <div className={`data-state ${kind}`} role={kind==="error"?"alert":"status"}><b>{labels[kind]}</b>{message&&<p>{message}</p>}{href&&<Link href={href}>{action??"돌아가기"} →</Link>}{onRetry&&<button onClick={onRetry}>다시 시도</button>}</div>;
}
