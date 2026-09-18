import {test,expect} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
const db=new PrismaClient({datasourceUrl:"file:./browser-test.db"});
test.afterAll(()=>db.$disconnect());
test("미등록·초대 없음·만료 INVITED·잘못된 이메일은 Resend와 토큰 생성 이전에 거부된다",async({page})=>{
 const prefix=crypto.randomUUID();
 const expired=await db.user.create({data:{email:prefix+"@expired.invalid",status:"INVITED",invitations:{create:{tokenHash:crypto.randomUUID(),expiresAt:new Date(Date.now()-1000)}}}});
 const noInvite=await db.user.create({data:{email:prefix+"@noinvite.invalid",status:"INVITED"}});
 try{
  for(const email of [prefix+"@unknown.invalid",expired.email,noInvite.email,"invalid-email"]){
   const csrf=await(await page.request.get("/api/auth/csrf")).json();
   const response=await page.request.post("/api/auth/signin/resend",{headers:{Origin:"http://localhost:3100","X-Auth-Return-Redirect":"1"},form:{email,csrfToken:csrf.csrfToken,callbackUrl:"http://localhost:3100/"}});
   expect(response.headers()["x-request-id"]).toBeTruthy();const result=await response.json();expect(result.url).toMatch(/error=/);
   expect(await(await page.request.get("http://127.0.0.1:3101/mail?email="+encodeURIComponent(email))).json()).toBeNull();
   expect(await db.verificationToken.count({where:{identifier:email}})).toBe(0);
  }
 }finally{await db.user.deleteMany({where:{id:{in:[expired.id,noInvite.id]}}});}
});
test("등록된 ACTIVE 사용자는 메일·해시 토큰·DB 세션을 생성하고 링크 재사용은 거부된다",async({page,browser})=>{
 const email=crypto.randomUUID()+"@active.invalid";const user=await db.user.create({data:{email,status:"ACTIVE",role:"ADMIN"}});
 try{
  const csrf=await(await page.request.get("/api/auth/csrf")).json();
  const response=await page.request.post("/api/auth/signin/resend",{headers:{Origin:"http://localhost:3100","X-Auth-Return-Redirect":"1"},form:{email,csrfToken:csrf.csrfToken,callbackUrl:"http://localhost:3100/"}});expect((await response.json()).url).toContain("verify-request");
  const mail=await(await page.request.get("http://127.0.0.1:3101/mail?email="+encodeURIComponent(email))).json();
  const link=mail.text.match(/http:\/\/localhost:3100\/api\/auth\/callback\/resend\?[^\s]+/)[0];
  const token=await db.verificationToken.findFirstOrThrow({where:{identifier:email}});expect(token.token).not.toBe(new URL(link).searchParams.get("token"));
  await page.goto(link);await expect(page.locator("nav")).toBeVisible();expect(await db.session.count({where:{userId:user.id}})).toBe(1);expect(await db.verificationToken.count({where:{identifier:email}})).toBe(0);
  const anonymous=await browser.newContext();try{const replay=await anonymous.newPage();await replay.goto(link);await expect(replay).toHaveURL(/\/login\?error=/);expect(await db.session.count({where:{userId:user.id}})).toBe(1);expect((await anonymous.request.get("http://localhost:3100/api/bootstrap")).status()).toBe(401);}finally{await anonymous.close();}
 }finally{await db.verificationToken.deleteMany({where:{identifier:email}});await db.user.delete({where:{id:user.id}});}
});
