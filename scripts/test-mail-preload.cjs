// Test-process transport replacement only. Never imported by the application.
const original=globalThis.fetch;
globalThis.fetch=async function(input,init){
 if(String(input)==='https://api.resend.com/emails')return original('http://127.0.0.1:3101/mail',{method:'POST',headers:{'content-type':'application/json'},body:init.body});
 return original(input,init);
};
