// Presentation only: shared by React entry screens and the existing HTTP 403 response.
export const authStyles = `
.auth-screen{padding:clamp(20px,5vw,64px) 24px;background:#f5f5f1;color:#172238;font:16px Arial,"Malgun Gothic","Apple SD Gothic Neo",sans-serif;letter-spacing:-.025em;word-break:keep-all}
.auth-container{max-width:960px;margin:0 auto;border:1px solid #dce1df;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 10px 30px #17223808}
.auth-brand-panel{padding:34px 48px 30px;background:#172238;color:#fff}
.auth-wordmark{display:flex;align-items:center;gap:10px;font-size:25px;font-weight:750;letter-spacing:-1px;margin:0 0 22px}
.auth-screen .brand-symbol{display:block;width:32px;height:36px;position:relative;flex:none}
.auth-screen .brand-symbol:before,.auth-screen .brand-symbol:after{content:"";position:absolute;height:9px;width:30px;transform:rotate(-32deg);border-radius:3px;left:0}
.auth-screen .brand-symbol:before{top:7px;background:#22b98f}.auth-screen .brand-symbol:after{top:20px;background:#8068ff}
.auth-brand-panel h1{font-size:40px;line-height:1.3;font-weight:700;letter-spacing:-1.5px;margin:0}
.auth-brand-panel p{font-size:16px;line-height:1.7;color:#c7d2e2;margin:14px 0 0;max-width:640px}
.auth-flow{display:flex;flex-wrap:wrap;gap:10px 14px;padding:0;margin:22px 0 0;list-style:none;font-size:14px;color:#cbf7ec}
.auth-flow li{display:flex;align-items:center;gap:14px}.auth-flow li+li:before{content:"→";color:#aa9fea}
.auth-login-panel{padding:32px 48px 34px;border-top:1px solid #dce1df}
.auth-login-panel h2{font-size:26px;line-height:1.4;margin:0 0 8px;font-weight:700;letter-spacing:-.7px}
.auth-login-panel p{font-size:16px;line-height:1.65;color:#596477;margin:0 0 18px}
.auth-form label{display:block;font-size:15px;font-weight:650;margin-bottom:8px}
.auth-input-row{display:flex;gap:12px;align-items:stretch}
.auth-input-row input{min-width:0;flex:1;border:1px solid #aab5c2;border-radius:8px;padding:14px 16px;font:16px Arial,sans-serif;background:#fff;color:#172238;letter-spacing:0}
.auth-input-row input::placeholder{color:#687486}.auth-input-row input[aria-invalid=true]{border-color:#b23b4a}
.auth-primary,.auth-secondary{display:inline-flex;justify-content:center;align-items:center;padding:14px 22px;border:1px solid transparent;border-radius:8px;font:650 16px Arial,"Malgun Gothic",sans-serif;text-decoration:none;white-space:nowrap;cursor:pointer}
.auth-primary{background:#172238;color:#fff}.auth-primary:hover:not(:disabled){background:#2c3c59}.auth-primary:disabled{background:#dbe1e8;color:#4b586b;cursor:wait}
.auth-secondary{background:#f3f1fd;color:#51429a;border-color:#dcd5f3}.auth-secondary:hover{background:#eae5fc}
.auth-screen :is(input,button,a):focus-visible,.auth-notice a:focus-visible{outline:3px solid #8068ff;outline-offset:3px}
.auth-login-panel .auth-help{font-size:14px;color:#596477;margin:16px 0 0;line-height:1.6}
.auth-login-panel .auth-error{color:#9a293b;font-size:15px;margin:12px 0 0;line-height:1.6}
.auth-state-icon{display:inline-flex;padding:10px;border-radius:50%;background:#e5f6ee;color:#236653;margin-bottom:14px}
.auth-login-panel .auth-recipient{color:#172238;font-weight:650;overflow-wrap:anywhere;word-break:normal}
.auth-loading-inline{display:flex;gap:12px;align-items:center;color:#596477;font-size:16px;line-height:1.7;padding:14px 0}
.auth-dot{width:10px;height:10px;border-radius:50%;background:#22b98f;flex:none}
.auth-notice{border:1px solid #dce1df;border-left:4px solid #8068ff;padding:20px 24px;border-radius:10px;background:#f8f9fc;color:#172238;font-size:16px;line-height:1.7}
.auth-notice h2{font-size:24px;margin:0 0 8px}.auth-notice p{margin:0 0 12px}.auth-notice a{color:#51429a;text-decoration:underline;font-weight:650}
.session-expired.auth-notice{margin:16px 24px}.auth-screen *{box-sizing:border-box}
@media(max-width:1024px){.auth-screen{padding:32px 24px}.auth-brand-panel{padding:30px 36px}.auth-brand-panel h1{font-size:36px}.auth-login-panel{padding:28px 36px}}
@media(max-width:600px){.auth-screen{padding:16px 14px}.auth-container{border-radius:14px}.auth-brand-panel{padding:24px}.auth-wordmark{font-size:23px;margin-bottom:18px}.auth-brand-panel h1{font-size:28px;line-height:1.35;letter-spacing:-1px}.auth-brand-panel p{font-size:14px;line-height:1.6;margin-top:12px}.auth-flow{gap:8px 10px;font-size:14px;margin-top:18px}.auth-flow li{gap:10px}.auth-login-panel{padding:24px}.auth-login-panel h2{font-size:23px}.auth-login-panel p{font-size:15px;margin-bottom:16px}.auth-input-row{flex-direction:column;gap:12px}.auth-input-row input{width:100%;padding:13px 14px}.auth-primary,.auth-secondary{padding:13px 16px}.auth-primary{width:100%}.auth-login-panel .auth-help{margin-top:14px}.auth-notice{padding:18px}.session-expired.auth-notice{margin:12px 16px}}
`;
export const deniedHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>접근 안내 · IntentBridge</title><style>body{margin:0;background:#f5f5f1}${authStyles}</style></head><body><main class="auth-screen"><div class="auth-container"><header class="auth-brand-panel"><div class="auth-wordmark"><span class="brand-symbol" aria-hidden="true"></span>IntentBridge</div><h1>광고 데이터를,<br>구매까지 연결합니다.</h1><p>유입부터 이탈 고객 분석, 성과 개선,<br>재방문 광고까지 하나의 흐름으로 관리합니다.</p></header><section class="auth-login-panel" aria-labelledby="denied-title"><h2 id="denied-title">이 페이지에 접근할 권한이 없습니다.</h2><p>접근 가능한 워크스페이스에서 업무를 이어가세요.</p><a class="auth-primary" href="/">대시보드로 이동</a> <a class="auth-secondary" href="#contact">관리자 문의</a><p class="auth-help" id="contact">워크스페이스 담당 관리자에게 접근 권한을 요청해 주세요.</p></section></div></main></body></html>`;
