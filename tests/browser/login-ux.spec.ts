import {test,expect,loginAs} from "./fixtures";
test("로그인/회원가입 1366·1024·768·390px 구조·키보드·이메일 검증·비밀번호 표시",async({page})=>{
 await page.goto("about:blank");await page.context().clearCookies();
 for(const width of [1366,1024,768,390]){
  await page.setViewportSize({width,height:900});await page.goto("/login");const email=page.getByLabel("이메일",{exact:true}),password=page.getByLabel("비밀번호",{exact:true});await expect(page.getByRole("button",{name:"로그인",exact:true})).toBeVisible();await email.focus();await page.keyboard.press("Tab");await expect(password).toBeFocused();await password.fill("visibility-test");await page.getByRole("button",{name:"비밀번호 보기"}).click();await expect(password).toHaveAttribute("type","text");await page.getByRole("button",{name:"회원가입",exact:true}).click();await expect(page.getByLabel("비밀번호 확인")).toBeVisible();await expect(password).toHaveValue("");await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:"test-results/signup-"+width+".png",fullPage:true});
 }
});
test("가입 처리 중 중복 차단과 오류 재시도",async({page})=>{
 await page.goto("about:blank");await page.context().clearCookies();let calls=0;let release:()=>void=()=>{};const wait=new Promise<void>(r=>{release=r});await page.route("**/api/auth/signup",async route=>{calls++;await wait;await route.fulfill({status:409,json:{error:"이미 가입된 이메일입니다."}})});
 await page.goto("/login");await page.getByRole("button",{name:"회원가입",exact:true}).click();await page.getByLabel("이름",{exact:true}).fill("검수");await page.getByLabel("이메일",{exact:true}).fill("signup@example.invalid");await page.getByLabel("비밀번호",{exact:true}).fill(process.env.TEST_LOGIN_PASSWORD!);await page.getByLabel("비밀번호 확인").fill(process.env.TEST_LOGIN_PASSWORD!);await page.getByRole("button",{name:"가입하기"}).click();await expect(page.getByRole("button",{name:"처리 중..."})).toBeDisabled();release();await expect(page.getByRole("status")).toContainText("이미 가입된 이메일");expect(calls).toBe(1);await expect(page.getByRole("button",{name:"가입하기"})).toBeEnabled();
});
test("로그인 상태 확인 중 폼 숨김·기존 세션의 관리자/광고주 진입 유지",async({page})=>{
 await page.goto("/login");await expect(page.getByTestId("admin-dashboard")).toBeVisible();await loginAs(page,"a@intentbridge.test");await page.goto("/login");await expect(page.getByTestId("advertiser-dashboard")).toBeVisible();await expect(page.locator(".workspace-lock")).toContainText("브랜드 A");await page.goto("about:blank");await page.context().clearCookies();let release:()=>void=()=>{};const wait=new Promise<void>(r=>{release=r});await page.route("**/api/auth/session",async route=>{await wait;await route.fulfill({json:{}})});await page.goto("/login");await expect(page.getByRole("status")).toHaveText("로그인 상태 확인 중...");await expect(page.getByLabel("이메일",{exact:true})).toHaveCount(0);release();await expect(page.getByLabel("이메일",{exact:true})).toBeVisible();
});

test("기존 오류 URL과 403 화면은 안전한 안내만 표시한다",async({page})=>{
 await page.goto("about:blank");await page.context().clearCookies();await page.goto("/login?error=Verification");await expect(page.getByRole("status")).toContainText("다시 로그인");await expect(page.locator(".auth-container")).not.toContainText("Verification");await loginAs(page,"a@intentbridge.test");const response=await page.goto("/settings");expect(response!.status()).toBe(403);await expect(page.getByRole("heading",{name:"이 페이지에 접근할 권한이 없습니다."})).toBeVisible();
});
test("미저장 작업이 있는 세션 만료는 작업을 유지하고 새 창 로그인을 안내한다",async({page})=>{
 await page.goto("/campaigns");await page.route("**/api/workspace-data",route=>route.abort("failed"));await page.getByLabel("실행안 이름",{exact:true}).fill("만료 안내 검수");await expect(page.getByRole("button",{name:"저장 다시 시도"})).toBeVisible();await page.route("**/api/auth/session",route=>route.fulfill({json:{}}));await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(page.locator(".session-expired")).toContainText("로그인이 만료되었습니다.");await expect(page.locator(".session-expired a")).toHaveAttribute("target","_blank");await expect(page.getByLabel("실행안 이름",{exact:true})).toHaveValue("만료 안내 검수");
});
