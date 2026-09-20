import {test,expect,loginAs,saved} from "./fixtures";
import {PrismaClient} from "@prisma/client";
import {hashPassword} from "../../lib/password";
const db=new PrismaClient({datasourceUrl:"file:./browser-test.db"});
test.afterAll(()=>db.$disconnect());
test("Decision: Signal 근거→Journey 강조→Audience→Campaign 원본 보존",async({page})=>{
 await page.goto("/operations?advertiser=brand-a&period=30");
 const feed=page.getByTestId("decision-feed"),drop=feed.locator('[data-signal-type="DROP_OFF"]').first();await expect(drop).toBeVisible();
 const id=await drop.getAttribute("data-signal-id");await drop.getByText("근거 보기",{exact:true}).click();await expect(drop).toContainText("2026-08-19 ~ 2026-09-17");await expect(drop).toContainText("2026-07-20 ~ 2026-08-18");await expect(drop).toContainText("Confidence HIGH");
 await drop.getByRole("link",{name:"고객 흐름 보기"}).click();await expect(page).toHaveURL(/signalStage=BeginCheckout/);await expect(page.locator('.fw-stage').filter({hasText:"BeginCheckout"})).toHaveAttribute("aria-pressed","true");
 await page.goto("/operations?advertiser=brand-a&period=30");await feed.locator(`[data-signal-id="${id}"]`).getByRole("button",{name:"재공략 설계"}).click();
 const dialog=page.getByRole("dialog",{name:"재공략 대상 확인"});await expect(dialog).toContainText("구매 완료 고객");await expect(dialog).toContainText("더 깊은 행동 그룹");await expect(dialog).toContainText("DEMO FORECAST");const size=await dialog.locator(".decision-size").innerText();const purchase=await dialog.locator('.decision-forecast dt').filter({hasText:"예상 구매"}).locator('+ dd').innerText();
 await dialog.getByRole("button",{name:"캠페인 설계",exact:true}).click();await expect(page.locator(".cs-origin")).toContainText("Decision Trail");await expect(page.locator(".cs-origin")).toContainText("장바구니 이후 이탈");await expect(page.locator("#cs-audience")).toContainText(size);await expect(page.locator("#cs-review")).toContainText(`구매 ${purchase}`);
 await expect(page.getByRole("combobox",{name:/Retargeting Channel/})).toHaveValue("meta");await page.getByRole("combobox",{name:/Retargeting Channel/}).selectOption("naver");await expect(page.locator("#cs-channel")).toContainText("Coming Soon");await expect(page.getByRole("button",{name:"Mock 캠페인 생성",exact:true})).toBeDisabled();await page.getByRole("combobox",{name:/Retargeting Channel/}).selectOption("meta");
 await page.getByRole("button",{name:"초안 저장",exact:true}).click();await saved(page);await page.reload();await expect(page.locator(".cs-origin")).toContainText("장바구니 이후 이탈");await expect(page.locator(".cs-origin")).toContainText(size);
 const docs=await(await page.request.get("/api/workspace-documents?advertiser=brand-a")).json();expect(JSON.stringify(docs)).toContain(id!);
});
test("Decision: REVIEWING/ACTIONED/DISMISSED 서버 유지·기간 변경·Report 같은 신호",async({page})=>{
 await page.goto("/operations?advertiser=brand-a&period=30");const feed=page.getByTestId("decision-feed"),first=feed.locator('.decision-row').first();await expect(first).toBeVisible();const id=await first.getAttribute("data-signal-id"),row=feed.locator(`[data-signal-id="${id}"]`);
 await row.getByRole("combobox").selectOption("REVIEWING");await saved(page);await page.reload();await expect(row.getByRole("combobox")).toHaveValue("REVIEWING");await row.getByRole("combobox").selectOption("ACTIONED");await saved(page);await page.reload();await expect(row.getByRole("combobox")).toHaveValue("ACTIONED");
 await row.getByRole("combobox").selectOption("DISMISSED");await expect(row).toHaveCount(0);await saved(page);await page.reload();await expect(feed.locator('.decision-row').first()).toBeVisible();await expect(row).toHaveCount(0);await feed.getByLabel("숨긴 신호 포함").check();await expect(row.getByRole("combobox")).toHaveValue("DISMISSED");await row.getByRole("combobox").selectOption("NEW");await saved(page);
 await page.goto("/reports?advertiser=brand-a&period=30");await expect(page.getByTestId("decision-feed").locator(`[data-signal-id="${id}"]`)).toBeVisible();
 await page.goto("/operations?advertiser=brand-a&period=7");await expect(page.getByTestId("decision-feed").locator('.decision-row').first()).toBeVisible();expect((await page.getByTestId("decision-feed").locator('.decision-row').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-signal-id')))).every(id=>id?.includes(':7:'))).toBe(true);
});
test("Decision: ADVERTISER 390px 조회 전용·ID 조작403·외부 호출 없음",async({page})=>{
 const errors:string[]=[],external:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=="http://localhost:3100")external.push(r.url())});
 await page.setViewportSize({width:390,height:844});await loginAs(page,"a@intentbridge.test");const feed=page.getByTestId("decision-feed");await expect(feed.locator('.decision-row').first()).toBeVisible();await expect(feed).not.toContainText("브랜드 B");await expect(feed.getByRole("button",{name:"재공략 설계"})).toHaveCount(0);await expect(feed.getByRole("combobox")).toHaveCount(0);await feed.locator('summary').first().click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:".validation/decision-mobile.png",fullPage:true});
 for(const url of ["/api/workspaces/brand-b/platform","/api/workspace-documents?advertiser=brand-b","/api/ga4?advertiser=brand-b&action=status"])expect((await page.request.get(url)).status()).toBe(403);
 expect((await page.request.put('/api/workspace-data',{headers:{Origin:'http://localhost:3100'},data:{key:'intentbridge:operations:v1:brand-a',revision:0,payload:{schema:1,rules:[],targets:{},guardrails:{},history:[],versions:[],alerts:[],decisions:{},signalStates:{'decision:brand-a:30:x':'DISMISSED'}}}})).status()).toBe(403);
 expect(errors).toEqual([]);expect(external).toEqual([]);
});
test("Decision: MANAGER 배정된 광고주만 브리핑·상태 변경도 Tenant 격리",async({page})=>{
 const email=crypto.randomUUID()+"@decision.invalid",user=await db.user.create({data:{email,name:"Decision 담당자",role:"MANAGER",status:"ACTIVE",passwordHash:await hashPassword(process.env.TEST_LOGIN_PASSWORD!),members:{create:{advertiserId:"brand-a",role:"MANAGER"}}}});
 try{await loginAs(page,email);const feed=page.getByTestId("decision-feed");await expect(feed.locator('.decision-row')).toHaveCount(1);await expect(feed).toContainText("브랜드 A");await expect(feed).not.toContainText("브랜드 B");expect((await page.request.get('/api/workspace-documents?advertiser=brand-b')).status()).toBe(403);await page.goto('/operations?advertiser=brand-a&period=30');await page.getByTestId('decision-feed').getByRole('combobox').first().selectOption('REVIEWING');await saved(page);await page.reload();await expect(page.getByTestId('decision-feed').getByRole('combobox').first()).toHaveValue('REVIEWING');}finally{await db.user.delete({where:{id:user.id}})}
});
test("Decision: 연결 오류가 있으면 DATA_ISSUE만 노출하고 회수 설계 억제",async({page})=>{
 await page.route('**/api/workspaces/brand-a/platform',async route=>{const response=await route.fetch(),body=await response.json();body.document.connections.ga4={state:'error',account:'demo',property:'demo',fields:[],lastSync:null};await route.fulfill({response,json:body})});
 await page.goto('/operations?advertiser=brand-a&period=30');const feed=page.getByTestId('decision-feed');await expect(feed.locator('.decision-row')).toHaveCount(1);await expect(feed.locator('.decision-row')).toHaveAttribute('data-signal-type','DATA_ISSUE');await expect(feed.getByRole('button',{name:'재공략 설계'})).toHaveCount(0);await expect(feed).toContainText('긴급 확인');
});
