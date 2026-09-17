import { test, expect } from "./fixtures";

test("광고주·기간 전환과 Workspace 이동", async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).origin !== "http://localhost:3100") external.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();
  await page.getByText("선택한 광고주 상세 성과 보기",{exact:true}).click();await expect(page.getByLabel("핵심 성과 지표")).toContainText("₩13,690,000");
  await page.getByLabel("광고주 워크스페이스").selectOption("brand-b");
  await expect(page.getByLabel("핵심 성과 지표")).toContainText("₩9,450,000");
  await page.getByRole("button", { name: "7일", exact: true }).click();
  await expect(page.getByLabel("핵심 성과 지표")).toContainText("₩2,268,000");
  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: /고객 여정/ }).click();
  await expect(page).toHaveURL(/\/funnel$/);
  await expect(page.getByRole("heading", { name: "고객 여정", exact: true })).toBeVisible();
  await expect(page.getByLabel("광고주 워크스페이스")).toHaveValue("brand-b");
  await expect(page.getByRole("button", { name: "7일", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: /성과 개선/ }).click();
  await expect(page).toHaveURL(/\/performance$/);
  await expect(page.getByTestId("projected-purchases")).toBeVisible();
  await expect(page.getByLabel("핵심 성과 지표")).toContainText("₩2,268,000");
  await page.getByRole("link", { name: "홈 대시보드로 돌아가기" }).click();
  await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("1366·1440·1920 및 모바일에서 가로 넘침 없이 접근 가능", async ({ page }) => {
  for (const width of [1366, 1440, 1920, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/funnel", "/performance"]) {
      await page.goto(route);
      await expect(page.getByLabel("광고주 워크스페이스")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `${route} at ${width}px`).toBe(false);
    }
    if (width === 1440 || width === 390) {
      await page.goto("/");
      await page.screenshot({ path: `test-results/overview-${width}.png`, fullPage: true });
    }
  }
});
