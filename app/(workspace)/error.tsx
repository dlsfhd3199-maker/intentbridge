"use client";
export default function WorkspaceError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){return <section className="access-denied" role="alert"><h2>문제가 발생했습니다.</h2><p>잠시 후 다시 시도해 주세요.{error.digest&&<> Reference: {error.digest}</>}</p><button onClick={reset}>다시 시도</button> <a href="/dashboard">대시보드</a></section>}
