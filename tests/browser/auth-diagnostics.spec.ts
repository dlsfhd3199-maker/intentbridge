import {test,expect,loginAs} from "./fixtures";
import type {APIRequestContext} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {hashPassword} from "../../lib/password";
const db=new PrismaClient({datasourceUrl:"file:./browser-test.db"});
const headers={Origin:"http://localhost:3100"};
async function login(request:APIRequestContext,email:string,password=process.env.TEST_LOGIN_PASSWORD!){const csrf=await(await request.get("http://localhost:3100/api/auth/csrf")).json();return request.post("http://localhost:3100/api/auth/callback/credentials",{headers:{...headers,"X-Auth-Return-Redirect":"1"},form:{email,password,csrfToken:csrf.csrfToken,callbackUrl:"http://localhost:3100/"}});}
test.afterAll(()=>db.$disconnect());
test("회원가입 → PENDING 차단 → 관리자 승인/연결 → ACTIVE 로그인 → Logout·세션 취소",async({page,browser})=>{
 const context=await browser.newContext();const visitor=await context.newPage(),email=crypto.randomUUID()+"@signup.invalid";
 try{
  await visitor.goto("http://localhost:3100/login");await visitor.getByRole("button",{name:"회원가입",exact:true}).click();await visitor.getByLabel("이름",{exact:true}).fill("가입 검수");await visitor.getByLabel("이메일",{exact:true}).fill(email);await visitor.getByLabel("비밀번호",{exact:true}).fill(process.env.TEST_LOGIN_PASSWORD!);await visitor.getByLabel("비밀번호 확인").fill(process.env.TEST_LOGIN_PASSWORD!);await visitor.getByRole("button",{name:"가입하기"}).click();await expect(visitor.getByRole("heading",{name:"가입이 완료되었습니다."})).toBeVisible();
  const user=await db.user.findUniqueOrThrow({where:{email},include:{members:true}});expect(user.status).toBe("PENDING");expect(user.role).toBe("ADVERTISER");expect(user.members).toHaveLength(0);expect(user.passwordHash).toMatch(/^\$argon2id\$/);expect(await db.session.count({where:{userId:user.id}})).toBe(0);
  await visitor.getByRole("button",{name:"로그인 화면으로"}).click();await visitor.getByLabel("비밀번호",{exact:true}).fill(process.env.TEST_LOGIN_PASSWORD!);await visitor.getByRole("button",{name:"로그인",exact:true}).click();await expect(visitor.getByRole("status")).toContainText("관리자 승인 대기");expect((await context.request.get("http://localhost:3100/api/bootstrap")).status()).toBe(401);
  expect((await page.request.patch("/api/admin/users",{headers,data:{id:user.id,action:"approve",advertiserId:"missing"}})).status()).toBe(400);expect((await db.user.findUniqueOrThrow({where:{id:user.id}})).status).toBe("PENDING");
  await page.goto("/settings");await page.getByRole("button",{name:"승인 대기",exact:true}).click();const row=page.getByRole("row").filter({hasText:email});await row.getByRole("button",{name:"승인 및 광고주 연결"}).click();await page.getByLabel("연결할 광고주").selectOption("brand-a");await page.getByRole("button",{name:"승인 및 연결",exact:true}).click();await expect(page.getByRole("dialog")).not.toBeVisible();expect(await db.advertiserMember.count({where:{userId:user.id,advertiserId:"brand-a"}})).toBe(1);
  await visitor.getByRole("button",{name:"로그인",exact:true}).click();await expect(visitor.getByTestId("advertiser-dashboard")).toBeVisible();expect((await context.request.get("http://localhost:3100/api/workspaces/brand-b")).status()).toBe(403);
  const cookies=await context.cookies();const csrf=await(await context.request.get("http://localhost:3100/api/auth/csrf")).json();await context.request.post("http://localhost:3100/api/auth/signout",{headers:{...headers,"X-Auth-Return-Redirect":"1"},form:{csrfToken:csrf.csrfToken}});expect(await db.session.count({where:{userId:user.id}})).toBe(0);await context.addCookies(cookies);expect((await context.request.get("http://localhost:3100/api/bootstrap")).status()).toBe(401);
  const audit=await db.auditLog.findMany({where:{resource:{in:[user.id,"authentication"]}}});expect(audit.some(a=>a.action==="user.approved")).toBe(true);expect(JSON.stringify(audit)).not.toContain(user.passwordHash!);expect(JSON.stringify(audit)).not.toContain(process.env.TEST_LOGIN_PASSWORD!);
 }finally{await context.close();await db.user.deleteMany({where:{email}});}
});
test("가입 입력·중복·CSRF·Role/광고주 주입과 반복 가입 방어",async({page})=>{
 const data={name:"검수",email:crypto.randomUUID()+"@invalid.test",password:process.env.TEST_LOGIN_PASSWORD!,passwordConfirm:process.env.TEST_LOGIN_PASSWORD!};
 expect((await page.request.post("/api/auth/signup",{headers:{Origin:"https://attacker.invalid"},data})).status()).toBe(403);
 for(const patch of [{email:"bad"},{password:"short"},{password:"12345678",passwordConfirm:"12345678"},{name:"x".repeat(121)},{role:"ADMIN"},{advertiserId:"brand-a"}])expect((await page.request.post("/api/auth/signup",{headers,data:{...data,...patch}})).status()).toBe(400);
 expect((await page.request.post("/api/auth/signup",{headers,data:{...data,email:"admin@intentbridge.test"}})).status()).toBe(409);
 const oversized=await page.request.post("/api/auth/signup",{headers,data:{...data,name:"x".repeat(5000)}});expect(oversized.status()).toBe(413);
 let limited;for(let i=0;i<2;i++)limited=await page.request.post("/api/auth/signup",{headers,data:{...data,password:"short"}});expect(limited!.status()).toBe(429);
});
test("잘못된 비밀번호·미등록·INVITED·DISABLED 차단 및 거절 감사 기록",async({page,browser})=>{
 const context=await browser.newContext();const email=crypto.randomUUID()+"@state.invalid";const user=await db.user.create({data:{email,status:"PENDING",passwordHash:await hashPassword(process.env.TEST_LOGIN_PASSWORD!)}});
 try{
  expect((await(await login(context.request,email,"Wrong-password-123!")).json()).url).not.toContain("code=pending");
  expect((await(await login(context.request,"missing@unknown.invalid")).json()).url).toContain("error=CredentialsSignin");
  expect((await page.request.patch("/api/admin/users",{headers,data:{id:user.id,action:"reject"}})).status()).toBe(200);expect((await(await login(context.request,email)).json()).url).toContain("code=disabled");
  await db.user.update({where:{id:user.id},data:{status:"INVITED"}});expect((await(await login(context.request,email)).json()).url).toContain("code=pending");expect(await db.session.count({where:{userId:user.id}})).toBe(0);expect(await db.auditLog.count({where:{resource:user.id,action:"user.rejected"}})).toBe(1);
  await loginAs(page,"a@intentbridge.test");expect((await page.request.patch("/api/admin/users",{headers,data:{id:user.id,action:"approve",advertiserId:"brand-a"}})).status()).toBe(403);
 }finally{await context.close();await db.user.delete({where:{id:user.id}});}
});
