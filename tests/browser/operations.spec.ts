import {saved,test,expect,type Page} from "./fixtures";

async function createCampaign(page:Page,name="운영 Cart") {
  await page.goto("/campaigns");
  await page.getByRole("combobox",{name:"세그먼트",exact:true}).selectOption("cart-14d");
  await page.getByRole("textbox",{name:"Campaign Name",exact:true}).fill(name);
  await page.getByLabel("일 예산 (원)",{exact:true}).fill("10000");
  await page.getByRole("button",{name:"Mock 캠페인 생성",exact:true}).click();
  await page.locator(".cs-list").getByRole("button",{name,exact:true}).click();
  await page.getByRole("button",{name:"Mock 활성화",exact:true}).click();
  await page.getByRole("button",{name:"닫기",exact:true}).click();
  await page.getByRole("link",{name:/광고 운영 Operations/}).click();
  await expect(page.getByRole("heading",{name:"캠페인 현재 상태",exact:true})).toBeVisible();
}
test("Rule AND·Guardrail·Mock 적용·Rollback·History·Version·Alert 복원",async({page})=>{
  const errors:string[]=[],external:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(new URL(r.url()).origin!=="http://localhost:3100")external.push(r.url());});
  await createCampaign(page);
  await page.getByLabel("Maximum Increase (%)",{exact:true}).fill("10");
  await page.getByRole("button",{name:"목표·안전 제한 저장",exact:true}).click();
  await expect(page.getByLabel("Maximum Increase (%)",{exact:true})).toHaveValue("10");
  await page.getByLabel("Rule Name",{exact:true}).fill("Cart 증액 Rule");
  await page.getByLabel("Value 1",{exact:true}).fill("0");
  await page.getByRole("button",{name:"AND 조건 추가",exact:true}).click();
  await expect(page.locator(".op-preview")).toContainText("RULE NOT MATCHED");
  await page.getByLabel("Value 2",{exact:true}).fill("4");
  await expect(page.locator(".op-preview")).toContainText("RULE MATCHED");
  await expect(page.locator(".op-preview")).toContainText("1회 증액 상한 10%");
  await page.getByRole("button",{name:"규칙 저장",exact:true}).click();
  const card=page.locator(".op-queue article").filter({hasText:"Cart 증액 Rule"}).first();
  await card.getByRole("button",{name:"검토",exact:true}).click();
  await expect(card).toContainText("₩11,000");
  await card.getByRole("button",{name:"Mock 적용",exact:true}).click();
  await expect(page.locator(".op-notice")).toContainText("APPLIED IN MOCK");
  await page.getByRole("combobox",{name:"History Filter",exact:true}).selectOption("Budget");
  const history=page.locator("section").filter({has:page.getByRole("heading",{name:"Change History",exact:true})});
  await expect(history.locator("tbody")).toContainText("₩10,000 → ₩11,000");
  await history.getByRole("button",{name:"되돌리기",exact:true}).first().click();
  await expect(page.locator(".op-notice")).toContainText("ROLLBACK");
  await page.getByRole("combobox",{name:"History Filter",exact:true}).selectOption("ROLLBACK");
  await expect(history.locator("tbody")).toContainText("₩11,000 → ₩10,000");
  await expect(page.getByText("Current Version",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"읽음 처리",exact:true}).first().click();
  await expect(page.getByRole("button",{name:"읽음",exact:true}).first()).toBeDisabled();
  await saved(page);await page.reload();
  await expect(page.locator(".op-saved-rule")).toContainText("Cart 증액 Rule");
  await expect(page.getByLabel("Maximum Increase (%)",{exact:true})).toHaveValue("10");
  await expect(page.getByRole("button",{name:"읽음",exact:true}).first()).toBeDisabled();
  await page.getByLabel("Minimum Audience Size",{exact:true}).fill("300");
  await page.getByRole("button",{name:"목표·안전 제한 저장",exact:true}).click();
  await expect(page.locator(".op-queue article").filter({hasText:"Cart 증액 Rule"}).first().getByRole("button",{name:"Mock 적용",exact:true})).toBeDisabled();
  await page.getByLabel("광고주 워크스페이스").selectOption("brand-b");
  await expect(page.locator(".op-saved-rule")).toHaveCount(0);await expect(page.locator(".op-alert")).toHaveCount(0);
  await saved(page);await page.reload();await expect(page.getByLabel("광고주 워크스페이스")).toHaveValue("brand-b");
  expect(errors).toEqual([]);expect(external).toEqual([]);
});
test("여러 Draft 열기·복제·삭제, Campaign 비교와 JSON/CSV/HTML 다운로드",async({page})=>{
  await page.goto("/campaigns");
  await page.getByRole("textbox",{name:"Campaign Name",exact:true}).fill("Checkout 초안");
  await page.getByRole("button",{name:"초안 저장",exact:true}).click();
  await page.getByRole("button",{name:"새 초안",exact:true}).click();
  await page.getByRole("textbox",{name:"Campaign Name",exact:true}).fill("Cart 초안");
  await page.getByRole("combobox",{name:"세그먼트",exact:true}).selectOption("cart-14d");
  await page.getByRole("button",{name:"초안 저장",exact:true}).click();
  const library=page.locator("section").filter({has:page.getByRole("heading",{name:"Campaign Drafts",exact:true})});
  await expect(library.locator("tbody tr")).toHaveCount(2);
  // Complete the existing autosave command before the next library mutation.
  await saved(page);
  await library.locator("tr").filter({hasText:"Checkout 초안"}).getByRole("button",{name:"복제",exact:true}).click();
  await expect(library.locator("tbody tr")).toHaveCount(3);
  await saved(page);
  await library.locator("tr").filter({hasText:"Checkout 초안 복사"}).getByRole("button",{name:"삭제",exact:true}).click();
  await expect(library.locator("tbody tr")).toHaveCount(2);
  await library.locator("tr").filter({hasText:"Checkout 초안"}).getByRole("button",{name:"열기",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Campaign Name",exact:true})).toHaveValue("Checkout 초안");
  await saved(page);await page.reload();await expect(library.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("link",{name:/광고 운영 Operations/}).click();
  await page.getByRole("combobox",{name:"비교 캠페인 1",exact:true}).selectOption({index:1});
  await page.getByRole("combobox",{name:"비교 캠페인 2",exact:true}).selectOption({index:2});
  await expect(page.locator('[aria-label="Campaign Compare"]')).toContainText("Forecast Purchase");
  for(const format of ["JSON","CSV","HTML"]){
    const waiting=page.waitForEvent("download");await page.getByRole("button",{name:`${format} Export`,exact:true}).first().click();
    const download=await waiting;expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format.toLowerCase()}$`));
    const stream=await download.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));const text=Buffer.concat(chunks).toString("utf8");
    expect(text).toContain("DEMO FORECAST");
    if(format==="JSON")expect(JSON.parse(text).campaign.status).toBe("DRAFT");
    if(format==="CSV")expect(text).toContain('"Automation Rules"');
    if(format==="HTML"){expect(text).toContain("Campaign Plan");const report=await page.context().newPage();await report.setContent(text);await expect(report.getByRole("heading",{name:"Campaign Plan",exact:true})).toBeVisible();await report.screenshot({path:"test-results/campaign-plan-report.png",fullPage:true});await report.close();}
  }
});
test("Named Simulation 저장·비교·복제·삭제·Performance 재열기·Campaign 전환",async({page})=>{
  await page.goto("/performance");
  await page.getByRole("button",{name:/추천 Recommended/}).click();
  await page.getByLabel("성과 예측 이름",{exact:true}).fill("Recommended Plan");
  await page.getByRole("button",{name:"Library에 저장",exact:true}).click();
  await page.getByRole("button",{name:/적극적 Aggressive/}).click();
  await page.getByLabel("성과 예측 이름",{exact:true}).fill("Aggressive Plan");
  await page.getByRole("button",{name:"Library에 저장",exact:true}).click();
  await page.getByRole("link",{name:"성과 예측 Library 열기 →",exact:true}).click();
  // Saving and client-side navigation finish independently; reload only after Operations opens.
  await expect(page).toHaveURL(/\/operations(?:\?|$)/);
  await expect(page.getByRole("heading",{name:"성과 예측 Library",exact:true})).toBeVisible();
  await saved(page);await page.reload();
  await page.getByRole("checkbox",{name:"Recommended Plan 비교",exact:true}).check();
  await page.getByRole("checkbox",{name:"Aggressive Plan 비교",exact:true}).check();
  await expect(page.locator('[aria-label="Simulation Compare"]')).toContainText("124");
  const library=page.locator("section").filter({has:page.getByRole("heading",{name:"성과 예측 Library",exact:true})});
  const row=library.locator("tbody tr").filter({hasText:"Recommended Plan"}).first();
  await row.getByRole("button",{name:"복제",exact:true}).click();
  await library.locator("tbody tr").filter({hasText:"Recommended Plan 복사"}).getByRole("button",{name:"삭제",exact:true}).click();
  await row.getByRole("button",{name:"성과 개선에서 열기",exact:true}).click();
  await expect(page.getByTestId("projected-purchases")).toHaveText("124건");
  await page.getByRole("link",{name:/광고 운영 Operations/}).click();
  await library.locator("tbody tr").filter({hasText:"Recommended Plan"}).first().getByRole("button",{name:"Campaign으로 전환",exact:true}).click();
  await expect(page.locator(".cs-origin")).toContainText("recommended");
});
test("Operations의 데스크톱/모바일 레이아웃과 Home 운영 요약",async({page})=>{
  await createCampaign(page);
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await expect(page.getByRole("heading",{name:"오늘의 운영 액션",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`${width}px`).toBe(false);await page.screenshot({path:`test-results/operations-${width}.png`,fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole("link",{name:/대시보드 Overview/}).click();await page.getByText("선택한 광고주 상세 성과 보기",{exact:true}).click();await expect(page.locator(".operations-home")).toContainText("Active Mock Campaigns1");
  await page.getByRole("link",{name:"광고 운영 열기 →",exact:true}).click();await expect(page.getByRole("heading",{name:"오늘의 운영 액션",exact:true})).toBeVisible();
});
