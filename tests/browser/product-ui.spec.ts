import {test,expect,loginAs,saved} from "./fixtures";
import {PrismaClient} from "@prisma/client";
import {hashPassword} from "../../lib/password";
const db=new PrismaClient({datasourceUrl:"file:./browser-test.db"});
test.afterAll(()=>db.$disconnect());
test("Product UI 2.0: 세 역할 Dashboard의 5개 viewport·차트 키보드·데이터 출처",async({page})=>{
 test.setTimeout(90000);
 const email=crypto.randomUUID()+"@ui-manager.invalid",manager=await db.user.create({data:{email,name:"담당 마케터",status:"ACTIVE",role:"MANAGER",passwordHash:await hashPassword(process.env.TEST_LOGIN_PASSWORD!),members:{create:[{advertiserId:"brand-a",role:"MANAGER"},{advertiserId:"brand-b",role:"MANAGER"}]}}});
 try{for(const [emailAddress,role] of [["admin@intentbridge.test","admin"],[email,"manager"],["a@intentbridge.test","advertiser"]]){
  await loginAs(page,emailAddress);await expect(page.getByTestId(role+"-dashboard")).toBeVisible();
  for(const width of [1440,1366,1024,768,390]){await page.setViewportSize({width,height:960});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator(".ui-chart-panel svg").first()).toBeVisible();await saved(page);await page.screenshot({path:`test-results/product-ui-${role}-${width}.png`,fullPage:true});}
  const chart=page.locator(".ui-chart-panel svg").first();await chart.focus();await page.keyboard.press("Home");const first=await page.locator(".ui-chart-readout").first().textContent();await page.keyboard.press("End");expect(await page.locator(".ui-chart-readout").first().textContent()).not.toBe(first);await expect(page.getByTestId(role+"-dashboard")).toContainText("MOCK DATA");
  if(role==="advertiser"){await page.goto("/reports");await expect(page.getByTestId("advertiser-reports")).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:"test-results/product-ui-report-390.png",fullPage:true});}
 }}finally{await db.user.delete({where:{id:manager.id}})}
});
test("Product UI 2.0: 상세 조정은 접힌 상태에서 열고 Forecast는 그대로 계산된다",async({page})=>{
 await page.goto("/performance");await expect(page.getByTestId("projected-purchases")).toBeVisible();await expect(page.locator(".ui-advanced")).not.toHaveAttribute("open","");await page.locator(".ui-advanced>summary").click();await expect(page.getByRole("slider")).toHaveCount(6);await page.getByRole("group",{name:"시나리오 선택"}).getByRole("button",{name:/추천/}).click();await expect(page.getByTestId("projected-purchases")).toHaveText("124건");await saved(page);
});
