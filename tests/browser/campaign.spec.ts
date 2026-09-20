import {saved, test, expect } from "./fixtures";

test("Campaign 편집·Forecast·저장·상세·복원·광고주 분리", async ({page}) => {
  const errors:string[] = [], external:string[] = [];
  page.on("pageerror", e=>errors.push(e.message)); page.on("request", r=>{if(new URL(r.url()).origin!=="http://localhost:3100") external.push(r.url());});
  await page.goto("/campaigns");
  const create = page.getByRole("button",{name:"Mock 캠페인 생성",exact:true});
  await expect(create).toBeEnabled();
  await expect(page.getByTestId("campaign-audience")).toHaveText("80명");
  await page.getByRole("combobox",{name:"세그먼트",exact:true}).selectOption("cart-14d");
  await expect(page.getByTestId("campaign-audience")).toHaveText("152명");
  await expect(page.getByRole("combobox",{name:"Campaign Objective",exact:true})).toHaveValue("Recover Cart");
  await page.getByRole("combobox",{name:"고객 그룹 Window",exact:true}).selectOption("3");
  await expect(page.getByTestId("campaign-audience")).not.toHaveText("152명");
  await page.getByRole("combobox",{name:"Campaign Objective",exact:true}).selectOption("Lead"); await expect(create).toBeDisabled();
  await page.getByRole("combobox",{name:"Campaign Objective",exact:true}).selectOption("Purchase");
  await page.getByRole("textbox",{name:"Headline",exact:true}).fill("테스트 광고 메시지");
  await expect(page.locator(".cs-feed h3")).toHaveText("테스트 광고 메시지");
  await page.getByRole("textbox",{name:"Body",exact:true}).fill("새 본문입니다.");
  await page.getByRole("textbox",{name:"CTA",exact:true}).fill("다시 확인하기");
  await expect(page.locator(".cs-feed")).toContainText("새 본문입니다.");
  await expect(page.locator(".cs-feed-bottom")).toContainText("다시 확인하기");
  await page.getByLabel("일 예산 (원)",{exact:true}).fill("0"); await expect(create).toBeDisabled();
  await page.getByLabel("일 예산 (원)",{exact:true}).fill("100");
  const before = await page.locator("#cs-forecast").textContent();
  await page.getByLabel("일 예산 (원)",{exact:true}).fill("1000");
  await expect(page.locator("#cs-forecast")).not.toHaveText(before!);
  await page.getByLabel("집행 기간 (일)",{exact:true}).fill("0"); await expect(create).toBeDisabled();
  await page.getByLabel("집행 기간 (일)",{exact:true}).fill("7");
  await page.getByRole("combobox",{name:"Retargeting Channel",exact:true}).selectOption("google"); await expect(create).toBeDisabled();
  await expect(page.getByTestId("campaign-audience")).toHaveText("0명");
  await page.getByRole("combobox",{name:"Retargeting Channel",exact:true}).selectOption("meta");
  await page.getByRole("combobox",{name:"Source Channel",exact:true}).selectOption("naver"); await expect(create).toBeDisabled();
  await page.getByRole("combobox",{name:"Source Channel",exact:true}).selectOption("chatgpt");
  await page.getByRole("checkbox",{name:"GPT Organic",exact:true}).uncheck();
  await page.getByRole("checkbox",{name:"GPT Ads",exact:true}).uncheck();
  await expect(page.getByTestId("campaign-audience")).toHaveText("0명"); await expect(create).toBeDisabled();
  await page.getByRole("checkbox",{name:"GPT Organic",exact:true}).check();
  await page.getByRole("checkbox",{name:"GPT Ads",exact:true}).check();
  await page.getByRole("combobox",{name:"Frequency Cap",exact:true}).selectOption("daily-2");
  await page.getByLabel("Purchase 제외 ON",{exact:true}).uncheck(); await expect(create).toBeDisabled();
  await page.getByLabel("Purchase 제외 OFF",{exact:true}).check();
  await page.getByRole("button",{name:"이름 자동 생성",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"UTM Parameters",exact:true})).toHaveValue(/utm_source=meta/);
  await page.getByRole("textbox",{name:"Campaign Name",exact:true}).fill("브랜드 A 캠페인");
  await page.getByRole("button",{name:"초안 저장",exact:true}).click();
  await expect(page.locator(".cs-list tbody tr")).toHaveCount(1);
  await create.click(); await expect(page.locator(".cs-list tbody tr")).toHaveCount(1);
  await expect(page.locator(".cs-list tbody")).toContainText("준비 완료");
  await page.getByRole("button",{name:"브랜드 A 캠페인",exact:true}).click();
  await page.getByRole("button",{name:"Mock 활성화",exact:true}).click();
  await expect(page.getByRole("dialog")).toContainText("MOCK ACTIVE");
  await page.getByRole("button",{name:"Mock 일시중지",exact:true}).click();
  await page.keyboard.press("Escape");
  await page.getByRole("combobox",{name:"상태 필터",exact:true}).selectOption("READY"); await expect(page.locator(".cs-list tbody tr")).toHaveCount(0);
  await page.getByRole("combobox",{name:"상태 필터",exact:true}).selectOption("PAUSED"); await expect(page.locator(".cs-list tbody tr")).toHaveCount(1);
  await saved(page);await page.reload(); await expect(page.getByRole("textbox",{name:"Campaign Name",exact:true})).toHaveValue("브랜드 A 캠페인");
  await page.getByLabel("광고주 워크스페이스").selectOption("brand-b"); await expect(page.locator(".cs-list tbody tr")).toHaveCount(0);
  await page.getByRole("textbox",{name:"Campaign Name",exact:true}).fill("브랜드 B 초안");
  await expect(page.locator(".cs-notice")).toContainText("광고주별 서버 자동 저장");
  await saved(page);await page.reload(); await expect(page.getByLabel("광고주 워크스페이스")).toHaveValue("brand-b");
  await expect(page.getByRole("textbox",{name:"Campaign Name",exact:true})).toHaveValue("브랜드 B 초안");
  await page.getByLabel("광고주 워크스페이스").selectOption("brand-a");
  await expect(page.getByRole("textbox",{name:"Campaign Name",exact:true})).toHaveValue("브랜드 A 캠페인");
  await page.getByRole("textbox",{name:"Headline",exact:true}).fill("새 초안 메시지"); await create.click();
  await expect(page.locator(".cs-list tbody tr")).toHaveCount(2);
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test("손상된 저장소와 저장 차단에서도 Mock 편집과 생성이 가능하다", async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem("intentbridge:campaigns:v1:brand-a",'{"version":1,"draft":{"bad":true},"campaigns":[{}]}');
    localStorage.setItem("intentbridge:campaign-handoff:broken",'{"id":"broken","advertiserId":"brand-a","period":30,"sourceIds":[],"origin":{"from":"Performance Lab","segmentId":"checkout-7d","recommendedBudgetChange":0}}');
  });
  await page.goto("/campaigns?handoff=broken");
  await expect(page.getByTestId("campaign-audience")).toHaveText("80명");
  await page.addInitScript(() => { Object.defineProperty(window,"localStorage",{get(){throw new Error("blocked");}}); });
  await saved(page);await page.reload();
  await expect(page.locator(".server-save-status")).toContainText("서버 저장 완료");
  await page.getByRole("button",{name:"Mock 캠페인 생성",exact:true}).click();
  await expect(page.locator(".cs-list tbody")).toContainText("준비 완료");
});

test("Funnel과 Performance 추천 및 저장된 성과 예측을 전달한다", async ({page}) => {
  await page.goto("/funnel");
  await page.getByRole("group",{name:"미구매 세그먼트 선택"}).getByRole("button").nth(1).click();
  await page.getByRole("button",{name:"Campaign 만들기",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"세그먼트",exact:true})).toHaveValue("cart-14d");
  await expect(page.locator(".cs-origin")).toContainText("Funnel Workspace");
  await page.getByRole("link",{name:/성과 개선 Performance/}).click();
  await page.getByRole("button",{name:"7일",exact:true}).click();
  await page.getByRole("button",{name:/적극적 Aggressive/}).click();
  await page.getByRole("button",{name:"30일",exact:true}).click();
  await page.getByRole("button",{name:/추천 Recommended/}).click();
  await page.getByRole("button",{name:"캠페인 만들기",exact:true}).first().click();
  await expect(page.locator(".cs-origin")).toContainText("Performance Lab");
  await expect(page.locator(".cs-origin")).toContainText("recommended");
  await expect(page.getByRole("button",{name:"Mock 캠페인 생성",exact:true})).toBeEnabled();
  const savedForecast = page.getByRole("combobox",{name:"저장된 성과 예측",exact:true});
  await expect(savedForecast.locator("option")).toHaveCount(3);
  await savedForecast.selectOption({index:2});
  await expect(page.locator(".cs-origin")).toContainText("aggressive");
  await expect(page.getByRole("button",{name:"7일",exact:true})).toHaveAttribute("aria-pressed","true");
  await saved(page);await page.reload(); await expect(page.locator(".cs-origin")).toContainText("Performance Lab");
});

test("Campaign Studio는 데스크톱·모바일에서 넘침 없이 작동한다", async ({page}) => {
  for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:1000}); await page.goto("/campaigns");
    await expect(page.getByTestId("campaign-audience")).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`${width}px`).toBe(false);
    await page.screenshot({path:`test-results/campaign-${width}.png`,fullPage:true});
  }
});
