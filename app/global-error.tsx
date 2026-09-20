"use client";
export default function GlobalError({reset}:{reset:()=>void}){return <html lang="ko"><body><main><h1>문제가 발생했습니다.</h1><button onClick={reset}>다시 시도</button> <a href="/">홈페이지</a></main></body></html>}
