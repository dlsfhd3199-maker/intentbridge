import {test,expect,loginAs,saved} from "./fixtures";
import {PrismaClient} from "@prisma/client";
import {hashPassword} from "../../lib/password";
const db=new PrismaClient({datasourceUrl:"file:./browser-test.db"});
test("미인증 페이지·API는 거부되고 위조한 Mock Role 쿠키도 무시한다",async({page})=>{
 await page.context().clearCookies();await page.context().addCookies([{name:"intentbridge-qa-role",value:"super_admin",domain:"localhost",path:"/"}]);
 for(const route of ["/dashboard","/campaigns","/operations","/settings","/reports"]){await page.goto(route);await expect(page).toHaveURL(/\/login/)}
 for(const route of ["/api/bootstrap","/api/admin/users","/api/admin/audit","/api/workspaces/brand-a","/api/ga4?advertiser=brand-a"]){expect((await page.request.get(route)).status()).toBe(401)}
});
for(const [email,own,other,otherName]of [["a@intentbridge.test","brand-a","brand-b","브랜드 B"],["b@intentbridge.test","brand-b","brand-a","브랜드 A"]])test(`${own}: 페이지·Campaign·Simulation·Reports·GA4에서 상대 Workspace IDOR 차단`,async({page})=>{
 await loginAs(page,email);const bootstrap=await (await page.request.get("/api/bootstrap")).json();expect(bootstrap.fixtures.advertisers.map((a:{id:string})=>a.id)).toEqual([own]);expect(JSON.stringify(bootstrap)).not.toContain(otherName);expect(await page.content()).not.toContain(otherName);await expect(page.getByLabel("현재 보기")).toHaveCount(0);
 expect((await page.request.get(`/api/workspaces/${own}`)).status()).toBe(200);await page.goto(`/advertisers/${own}`);await expect(page.getByText("할당된 워크스페이스입니다.",{exact:false})).toBeVisible();
 for(const route of [`/advertisers/${other}`,`/campaigns?advertiser=${other}`,`/performance?advertiser=${other}`,`/reports?advertiser=${other}`,"/operations","/connections","/settings"]){const response=await page.goto(route);expect(response?.status()).toBe(403);expect(await page.content()).not.toContain(otherName);await expect(page.getByRole("heading",{name:"이 페이지에 접근할 권한이 없습니다."})).toBeVisible();}
 await page.context().addCookies([{name:"intentbridge-qa-role",value:"super_admin",domain:"localhost",path:"/"}]);await page.evaluate(()=>{localStorage.setItem("role","super_admin");localStorage.setItem("advertiserId","brand-b")});
 for(const route of [`/api/workspaces/${other}`,`/api/ga4?advertiser=${other}`,`/api/workspaces/${own}/connection`,"/api/admin/users","/api/admin/audit"]){const r=await page.request.get(route);expect(r.status()).toBe(403);expect(await r.text()).not.toContain(otherName)}
 for(const path of [`/api/ga4?advertiser=${own}&mode=real`,`/api/ga4?advertiser=${own}`])expect((await page.request.post(path,{headers:{Origin:"http://localhost:3100"}})).status()).toBe(403);
 expect((await page.request.get(`/api/ga4?advertiser=${own}&mode=mock`)).status()).toBe(403);
 expect((await page.request.put("/api/workspace-data",{headers:{Origin:"http://localhost:3100"},data:{key:`intentbridge:campaigns:v1:${own}`,revision:0,payload:{}}})).status()).toBe(403);
 expect((await page.request.patch("/api/admin/users",{headers:{Origin:"http://localhost:3100"},data:{id:"dev-a",role:"SUPER_ADMIN",status:"ACTIVE",advertiserIds:[own]}})).status()).toBe(403);
});
test("ADMIN A/B 접근·서버 저장·세션 해시·Audit·CSRF·revision 충돌",async({page})=>{
 for(const id of ["brand-a","brand-b"])expect((await page.request.get(`/api/workspaces/${id}`)).status()).toBe(200);
 await page.goto("/campaigns");await page.getByLabel("실행안 이름",{exact:true}).fill("DB 지속성 검증");await page.getByRole("button",{name:"실행안 저장",exact:true}).click();await saved(page);await page.reload();await expect(page.locator(".cs-list")).toContainText("DB 지속성 검증");
 const documents=await (await page.request.get("/api/workspace-documents?advertiser=brand-a")).json();const doc=documents.find((d:{key:string})=>d.key==="intentbridge:campaigns:v1:brand-a");expect(doc.revision).toBeGreaterThan(0);
 const payload={key:doc.key,payload:doc.payload,revision:0};expect((await page.request.put("/api/workspace-data",{data:payload,headers:{Origin:"http://localhost:3100"}})).status()).toBe(409);expect((await page.request.put("/api/workspace-data",{data:payload,headers:{Origin:"https://attacker.invalid"}})).status()).toBe(403);
 const other=structuredClone(doc.payload);other.campaigns[0].advertiserId="brand-b";expect((await page.request.put("/api/workspace-data",{data:{...payload,payload:other,revision:doc.revision},headers:{Origin:"http://localhost:3100"}})).status()).toBe(400);
 const cookie=(await page.context().cookies()).find(c=>c.name.endsWith("session-token"))!;expect(cookie.httpOnly).toBe(true);const session=await db.session.findFirst({where:{userId:"dev-admin",}});expect(session).toBeTruthy();expect(session!.sessionToken).not.toBe(cookie.value);
 const audit=await (await page.request.get("/api/admin/audit")).json();expect(audit.some((a:{actorUserId:string;advertiserId:string})=>a.actorUserId==="dev-admin"&&a.advertiserId==="brand-a")).toBe(true);expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe("{}");
});
test("승인·사용자 연결·비활성화·마지막 관리자 보호는 서버에서 처리한다",async({page})=>{
 const headers={Origin:"http://localhost:3100"};const email=`invite-${Date.now()}@intentbridge.test`;
 const user=await db.user.create({data:{email,name:"검수 사용자",role:"ADVERTISER",status:"PENDING",passwordHash:await hashPassword(process.env.TEST_LOGIN_PASSWORD!)}});
 expect((await page.request.patch("/api/admin/users",{headers,data:{id:user.id,action:"approve",advertiserId:"brand-a"}})).status()).toBe(200);
 await page.waitForLoadState("networkidle");const adminCookies=await page.context().cookies();await loginAs(page,email);expect((await db.user.findUnique({where:{id:user.id}}))?.status).toBe("ACTIVE");await page.waitForLoadState("networkidle");const inviteCookies=await page.context().cookies();await page.context().clearCookies();await page.context().addCookies(adminCookies);await page.goto("/dashboard");await page.waitForLoadState("networkidle");
 expect((await page.request.patch("/api/admin/users",{headers,data:{id:user.id,name:user.name,role:"ADVERTISER",status:"DISABLED",advertiserIds:["brand-b"]}})).status()).toBe(200);
 expect((await page.request.patch("/api/admin/users",{headers,data:{id:"dev-admin",name:"Admin",role:"ADVERTISER",status:"ACTIVE",advertiserIds:["brand-a"]}})).status()).toBe(409);
 await page.context().clearCookies();await page.context().addCookies(inviteCookies);expect((await page.request.get("/api/bootstrap")).status()).toBe(401);await page.goto("/dashboard");await expect(page).toHaveURL(/\/login/);
 await db.user.delete({where:{id:user.id}});
});
test("만료 세션은 DB에서 확인하며 보호 페이지로 재진입할 수 없다",async({page})=>{
 const cookie=(await page.context().cookies()).find(c=>c.name.endsWith("session-token"))!;expect(cookie.httpOnly).toBe(true);await db.session.updateMany({where:{userId:"dev-admin"},data:{expires:new Date(0)}});expect((await page.request.get("/api/bootstrap")).status()).toBe(401);await page.goto("/reports");await expect(page).toHaveURL(/\/login/);
});
test("관리자 UI에서 광고주 생성·수정·사용자 승인를 저장하고 Audit에 기록한다",async({page})=>{
 const name=`검수 Workspace ${Date.now()}`,email=`ui-${Date.now()}@intentbridge.test`;let workspaceId:string|undefined;
 try{
  await page.goto("/advertisers");await page.getByRole("button",{name:"+ 새 광고주",exact:true}).click();await expect(page.getByRole("dialog",{name:"새 광고주"})).toBeVisible();await page.getByLabel("광고주 이름",{exact:true}).fill(name);await page.getByLabel("업종",{exact:true}).fill("검수");await page.getByLabel("대표 상품",{exact:true}).fill("검수 상품");await page.getByRole("button",{name:"광고주 생성",exact:true}).click();await expect(page).toHaveURL(/\/connections\?advertiser=/);await page.goto("/advertisers");await expect(page.getByRole("table",{name:"광고주 목록",exact:true}).locator("tbody tr")).toContainText(["브랜드 A","브랜드 B",name]);
  workspaceId=(await db.advertiser.findFirst({where:{name}}))!.id;await page.getByRole("button",{name:`${name} 수정`,exact:true}).click();await page.getByLabel("광고주 이름",{exact:true}).fill(name+" 수정");await page.getByRole("button",{name:"광고주 변경 저장",exact:true}).click();await expect(page.getByRole("button",{name:`${name} 수정 수정`,exact:true})).toBeVisible();
  await db.user.create({data:{email,name:"UI 승인",status:"PENDING",passwordHash:await hashPassword(process.env.TEST_LOGIN_PASSWORD!)}});
  await page.goto(`/advertisers/${workspaceId}`);const row=page.getByRole("row").filter({hasText:email});await row.getByRole("button",{name:"승인 및 광고주 연결"}).click();await page.getByRole("dialog").getByLabel("연결할 광고주").selectOption(workspaceId!);await page.getByRole("button",{name:"승인 및 연결",exact:true}).click();await expect(row).toContainText("ACTIVE");expect(await db.auditLog.count({where:{advertiserId:workspaceId}})).toBeGreaterThanOrEqual(2);
 }finally{await db.user.deleteMany({where:{email}});await db.advertiser.deleteMany({where:workspaceId?{id:workspaceId}:{name:{in:[name,name+" 수정"]}}});}
});
