import {test,expect,saved} from "./fixtures";

test("Reality: recovery plan, Organic source only, handoff and no external write request",async({page})=>{
 const external:string[]=[];page.on("request",request=>{if(new URL(request.url()).origin!=="http://localhost:3100")external.push(request.url())});
 await page.goto("/operations?advertiser=brand-a&period=30");
 const feed=page.getByTestId("decision-feed");
 const recovery=feed.locator('[data-signal-type="RECOVERY_OPPORTUNITY"]').first();
 await expect(recovery.getByRole("link",{name:"고객 조건 확인",exact:true})).toHaveAttribute("href",/\/funnel\?advertiser=brand-a/);
 const performance=feed.locator('[data-signal-type="PERFORMANCE_DROP"]').first();
 await expect(performance.getByRole("link",{name:"성과 원인 확인",exact:true})).toHaveAttribute("href",/\/performance\?/);
 await expect(performance.getByRole("button",{name:"대상 조건으로 실행안 작성"})).toHaveCount(0);
 await recovery.getByRole("button",{name:"대상 조건으로 실행안 작성"}).click();
 await page.getByRole("dialog").getByRole("button",{name:"실행안 작성",exact:true}).click();
 await expect(page.getByRole("combobox",{name:"유입 경로",exact:true})).toHaveValue("chatgpt");
 const target=page.getByRole("combobox",{name:"검토 채널",exact:true});
 await expect(target.locator('option[value="chatgpt"]')).toHaveCount(0);
 await expect(page.locator('#cs-channel')).toContainText("Experimental / Planned");
 await page.getByLabel("실행안 이름",{exact:true}).fill("Reality 실행안");
 await page.getByRole("button",{name:"실행안 저장",exact:true}).click();await saved(page);
 await expect(page.locator('.cs-list')).toContainText("실행 준비");
 await expect(page.locator('.cs-handoff')).toContainText("마케터가 해당 광고 플랫폼에서 진행");
 await expect(page.getByRole("button",{name:/Mock 캠페인 생성|Launch|Publish|Audience Sync/})).toHaveCount(0);
 await page.locator('.cs-list').getByRole("button",{name:"Reality 실행안",exact:true}).click();
 await page.getByRole("button",{name:"검토 완료로 표시",exact:true}).click();
 await expect(page.getByRole("dialog")).toContainText("검토 완료");
 await page.getByRole("button",{name:"보류로 표시",exact:true}).click();
 await expect(page.getByRole("dialog")).toContainText("보류");
 await page.getByRole("button",{name:"닫기",exact:true}).click();await saved(page);
 await page.goto('/reports');await expect(page.getByRole('heading',{name:'이번 기간 실행안과 운영 제안'})).toBeVisible();await expect(page.locator('.executive-report')).toContainText('실제 집행 여부 미확인');
 expect(external).toEqual([]);
});

test("Reality: positive signal opens simulation and data issue opens connection review",async({page})=>{
 await page.goto('/operations?advertiser=brand-b&period=30');
 const positive=page.getByTestId('decision-feed').locator('[data-signal-type="POSITIVE_MOMENTUM"]').first();
 await expect(positive.getByRole('button',{name:'대상 조건으로 실행안 작성'})).toHaveCount(0);
 await positive.getByRole('link',{name:'유지·확대 시뮬레이션 검토'}).click();
 await expect(page).toHaveURL(/\/performance\?advertiser=brand-b&period=30/);
 await expect(page.getByRole('group',{name:'시나리오 선택'})).toBeVisible();
 await page.route('**/api/workspaces/brand-a/platform',async route=>{const response=await route.fetch(),body=await response.json();body.document.connections.ga4={state:'error',account:'demo',property:'demo',fields:[],lastSync:null};await route.fulfill({response,json:body})});
 await page.goto('/operations?advertiser=brand-a&period=30');
 const issue=page.getByTestId('decision-feed').locator('[data-signal-type="DATA_ISSUE"]');
 await expect(issue.getByRole('button',{name:'대상 조건으로 실행안 작성'})).toHaveCount(0);
 await issue.getByRole('link',{name:'데이터 연결 확인'}).click();
 await expect(page).toHaveURL(/\/connections\?advertiser=brand-a/);
 await expect(page.getByRole('heading',{name:'데이터 연결 센터',exact:true})).toBeVisible();
});
