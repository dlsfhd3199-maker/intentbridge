import {test as base,expect,type Page} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
export {expect};export type {Page};
const db=new PrismaClient({datasourceUrl:"file:./browser-test.db"});
const sessions=new Map<string,unknown>();
export async function loginAs(page:Page,email="admin@intentbridge.test"){
 await page.goto("about:blank");await page.context().clearCookies();
 const cached=sessions.get(email) as Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>|undefined;
 if(cached){await page.context().addCookies(cached);if((await page.request.get("/api/bootstrap")).ok()){await page.goto("/");return;}sessions.delete(email);await page.context().clearCookies();}
 await page.goto("/login");const csrf=await (await page.request.get("/api/auth/csrf")).json();
 const response=await page.request.post("/api/auth/callback/credentials",{form:{email,password:process.env.TEST_LOGIN_PASSWORD!,csrfToken:csrf.csrfToken,callbackUrl:"http://localhost:3100/"},headers:{Origin:"http://localhost:3100","X-Auth-Return-Redirect":"1"},maxRedirects:0});expect(response.status()).toBeLessThan(400);expect((await response.json()).url).not.toContain("error=");
 await page.goto("/");await expect(page.locator("nav")).toBeVisible();sessions.set(email,await page.context().cookies());
}
export async function saved(page:Page){await expect(page.locator(".server-save-status")).toHaveAttribute("data-pending","0");await expect(page.locator(".server-save-status")).toHaveText("서버 저장 완료");}
export const test=base.extend({page:async({page},use)=>{
 await db.$transaction([db.workspaceDocument.deleteMany(),db.campaign.deleteMany(),db.campaignDraft.deleteMany(),db.campaignVersion.deleteMany(),db.savedSimulation.deleteMany(),db.automationRule.deleteMany(),db.operationHistory.deleteMany(),db.alert.deleteMany(),db.userSetting.deleteMany(),db.auditLog.deleteMany(),db.advertiserConnection.updateMany({data:{dataMode:"mock",propertyId:null}})]);
 await loginAs(page);await use(page);
}});
export type {Download} from "@playwright/test";
