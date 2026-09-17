import {test,expect,loginAs,saved} from "./fixtures";
import {PrismaClient} from "@prisma/client";
const db=new PrismaClient({datasourceUrl:"file:./browser-test.db"});
const headers={Origin:"http://localhost:3100"};
test("원자적 배치는 중간 revision 실패 시 Campaign·Version·Audit을 모두 롤백한다",async({page})=>{
 await page.goto("/campaigns");await page.getByLabel("Campaign Name",{exact:true}).fill("원자적 검수");await page.getByRole("button",{name:"Mock 캠페인 생성",exact:true}).click();await saved(page);
 const docs=await (await page.request.get("/api/workspace-documents?advertiser=brand-a")).json();const campaign=docs.find((d:{key:string})=>d.key.includes(":campaigns:"));const before=await db.campaign.findMany({where:{advertiserId:"brand-a"}}),audit=await db.auditLog.count();const invalid=structuredClone(campaign);invalid.payload.campaigns[0].budget.daily=-1;expect((await page.request.put("/api/workspace-data",{headers,data:invalid})).status()).toBe(400);campaign.payload.campaigns[0].name="실패하면 없어야 함";
 const failed=await page.request.put("/api/workspace-data",{headers:{...headers,"Idempotency-Key":crypto.randomUUID()},data:{documents:[campaign,{key:"intentbridge:simulation-library:v1:brand-a",payload:[],revision:999}]}});expect(failed.status()).toBe(409);expect(await db.campaign.findMany({where:{advertiserId:"brand-a"}})).toEqual(before);expect(await db.auditLog.count()).toBe(audit);
});
test("동일 요청 재시도는 한 번만 저장하고 payload 변조·음수·과도한 문자열은 거부한다",async({page})=>{
 const key=crypto.randomUUID(),input={key:"intentbridge:simulation-library:v1:brand-a",payload:[],revision:0};const h={...headers,"Idempotency-Key":key};const first=await page.request.put("/api/workspace-data",{headers:h,data:input});expect(first.status()).toBe(200);const second=await page.request.put("/api/workspace-data",{headers:h,data:input});expect(await second.json()).toEqual(await first.json());expect(await db.auditLog.count({where:{resource:input.key}})).toBe(1);expect((await page.request.put("/api/workspace-data",{headers:h,data:{...input,revision:1}})).status()).toBe(409);
 expect((await page.request.post("/api/admin/advertisers",{headers,data:{name:"x".repeat(121)}})).status()).toBe(400);expect((await page.request.post("/api/admin/users",{headers,data:{name:"검수",email:"bad",role:"ADVERTISER",advertiserIds:["brand-a"]}})).status()).toBe(400);
 expect((await page.request.post("/api/admin/users",{headers,data:{name:"중복",email:"a@intentbridge.test",role:"ADVERTISER",advertiserIds:["brand-b"]}})).status()).toBe(409);
});
test("Health는 최소 정보, Readiness는 ADMIN 전용이며 초기 Bootstrap에 업무 원문이 없다",async({page})=>{
 const health=await page.request.get("/api/health");expect(await health.json()).toEqual({status:"ok"});expect(health.headers()["x-content-type-options"]).toBe("nosniff");expect((await page.request.get("/api/admin/readiness")).status()).toBe(200);
 const bootstrap=await (await page.request.get("/api/bootstrap")).json();expect(bootstrap.documents.some((d:{key:string})=>/campaigns|operations/.test(d.key))).toBe(false);
 await loginAs(page,"a@intentbridge.test");expect((await page.request.get("/api/admin/readiness")).status()).toBe(403);expect((await page.request.get("/api/workspace-documents?advertiser=brand-b")).status()).toBe(403);expect((await page.request.get("/api/workspace-summary?advertiser=brand-b")).status()).toBe(403);
});
test("동일 Email 로그인 요청은 서버에서 429 제한하며 Request ID를 반환한다",async({page})=>{
 const csrf=await(await page.request.get("/api/auth/csrf")).json();let last;for(let i=0;i<6;i++)last=await page.request.post("/api/auth/signin/resend",{headers:{...headers,"X-Auth-Return-Redirect":"1"},form:{email:"not-invited-rate-test@example.invalid",csrfToken:csrf.csrfToken,callbackUrl:"http://localhost:3100/"},maxRedirects:0});expect(last!.status()).toBe(429);expect(last!.headers()["x-request-id"]).toBeTruthy();expect(await last!.text()).not.toContain("not-invited-rate-test");
});

test("이메일 제공자 실패는 성공으로 표시하지 않으며 비활성 사용자는 로그인할 수 없다",async({page})=>{
 await page.goto("about:blank");await page.context().clearCookies();await page.goto("/login");await page.request.post("http://127.0.0.1:3101/control",{data:{rejectMail:true}});
 try{await page.getByLabel("이메일").fill("a@intentbridge.test");await page.getByRole("button",{name:"로그인 링크 받기",exact:true}).click();await expect(page.getByRole("status")).toContainText("보내지 못했습니다");}finally{await page.request.post("http://127.0.0.1:3101/control",{data:{rejectMail:false}})}
 const user=await db.user.create({data:{email:"disabled-foundation@intentbridge.test",role:"ADVERTISER",status:"DISABLED"}});
 try{const csrf=await(await page.request.get("/api/auth/csrf")).json();await page.request.post("/api/auth/signin/resend",{form:{email:user.email,csrfToken:csrf.csrfToken},headers:{...headers,"X-Auth-Return-Redirect":"1"}});expect(await(await page.request.get("http://127.0.0.1:3101/mail?email="+user.email)).json()).toBeNull();expect(await db.session.count({where:{userId:user.id}})).toBe(0);}finally{await db.user.delete({where:{id:user.id}})}
});

test("저장 응답 유실 후 동일 키 재시도는 중복 Campaign·Audit을 만들지 않는다",async({page})=>{
 await page.goto("/campaigns");await saved(page);await page.getByLabel("Campaign Name",{exact:true}).fill("응답 유실 복구");await saved(page);
 let lost=false;await page.route("**/api/workspace-data",async route=>{const body=route.request().postDataJSON();if(!lost&&body.documents?.some((d:{payload?:{campaigns?:{status:string}[]}})=>d.payload?.campaigns?.some(c=>c.status==="READY"))){lost=true;await route.fetch();await route.abort("failed");}else await route.continue();});
 await page.getByRole("button",{name:"Mock 캠페인 생성",exact:true}).click();await expect(page.getByRole("button",{name:"저장 다시 시도"})).toBeVisible();expect(await db.campaign.count({where:{advertiserId:"brand-a"}})).toBe(1);await expect(page.locator(".cs-notice")).not.toContainText("READY 저장 완료");const audit=await db.auditLog.count();await page.getByRole("button",{name:"저장 다시 시도"}).click();await saved(page);expect(await db.auditLog.count()).toBe(audit);expect(await db.campaign.count({where:{advertiserId:"brand-a"}})).toBe(1);await page.reload();await expect(page.locator(".cs-list")).toContainText("응답 유실 복구");
});
