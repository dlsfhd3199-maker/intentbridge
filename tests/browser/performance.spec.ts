import {saved, test, expect } from "./fixtures";

test("시나리오·6개 레버 경계·Reset·추천·What-if가 실시간으로 반영된다", async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).origin !== "http://localhost:3100") external.push(request.url()); });
  await page.goto("/performance");
  const result = page.getByTestId("projected-purchases");
  await expect(result).toHaveText("94건");
  const scenario = page.getByRole("group", { name: "시나리오 선택" });
  await scenario.getByRole("button", { name: /추천/ }).click();
  await expect(result).toHaveText("124건");
  await expect(page.getByTestId("confidence")).toHaveText("MEDIUM");
  await scenario.getByRole("button", { name: /적극적/ }).click();
  await expect(page.getByTestId("confidence")).toHaveText("LOW");
  await scenario.getByRole("button", { name: /보수적/ }).click();
  await expect(page.getByTestId("confidence")).toHaveText("HIGH");
  await page.locator(".ui-advanced > summary").click();
  const sliders = page.getByRole("slider");
  await expect(sliders).toHaveCount(6);
  for (let index = 0; index < 6; index++) {
    const slider = sliders.nth(index);
    await slider.focus(); await page.keyboard.press("End");
    await expect(slider).toHaveValue((await slider.getAttribute("max"))!);
    await slider.focus(); await page.keyboard.press("Home");
    await expect(slider).toHaveValue((await slider.getAttribute("min"))!);
  }
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(result).toHaveText("94건");
  for (let index = 0; index < 6; index++) await expect(sliders.nth(index)).toHaveValue("0");
  await page.getByLabel("Acquisition Budget 값", { exact: true }).fill("50");
  await expect(page.getByRole("region", { name: "현재 대비 예상 성과" })).toContainText("악화");
  await page.getByRole("button", { name: "추천안으로 계산" }).first().click();
  await expect(page.getByLabel("Acquisition Budget 값", { exact: true })).toHaveValue("0");
  await page.getByRole("button", { name: "추천안으로 계산" }).first().click();
  await expect(result).not.toHaveText("94건");
  const whatIf = page.getByRole("group", { name: "What-if" });
  await whatIf.getByRole("button", { name: "재공략 예산 +30%", exact: true }).click();
  await expect(page.getByLabel("Retargeting Budget 값", { exact: true })).toHaveValue("30");
  await whatIf.getByRole("button", { name: "Landing +10%", exact: true }).click();
  await expect(page.getByLabel("Landing CVR Improvement 값", { exact: true })).toHaveValue("10");
  await whatIf.getByRole("button", { name: "Total Budget +20%", exact: true }).click();
  await expect(page.getByLabel("Acquisition Budget 값", { exact: true })).toHaveValue("20");
  await expect(page.getByLabel("Retargeting Budget 값", { exact: true })).toHaveValue("20");
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test("광고주·기간별 설정 및 Forecast는 이동·새로고침 후 유지된다", async ({ page }) => {
  await page.goto("/performance");
  await expect(page.getByTestId("projected-purchases")).toHaveText("94건");
  await page.getByRole("button", { name: /추천 Recommended/ }).click();
  await expect(page.getByTestId("projected-purchases")).toHaveText("124건");
  await page.getByLabel("광고주 워크스페이스").selectOption("brand-b");
  await expect(page.getByTestId("projected-purchases")).toHaveText("63건");
  await page.getByRole("button", { name: /적극적 Aggressive/ }).click();
  const brandB = await page.getByTestId("projected-purchases").textContent();
  await page.getByLabel("광고주 워크스페이스").selectOption("brand-a");
  await expect(page.getByTestId("projected-purchases")).toHaveText("124건");
  await page.getByRole("button", { name: "7일", exact: true }).click();
  await expect(page.getByLabel("Landing CVR Improvement 값", { exact: true })).toHaveValue("0");
  await page.getByRole("button", { name: "30일", exact: true }).click();
  await expect(page.getByTestId("projected-purchases")).toHaveText("124건");
  await saved(page);await page.reload();
  await expect(page.getByTestId("projected-purchases")).toHaveText("124건");
  await page.getByLabel("광고주 워크스페이스").selectOption("brand-b");
  await expect(page.getByTestId("projected-purchases")).toHaveText(brandB!);
  await expect(page.getByRole("button", { name: /적극적 Aggressive/ })).toHaveAttribute("aria-pressed", "true");
});

test("Performance Lab은 좁은 화면에서도 조작과 결과 확인이 가능하다", async ({ page }) => {
  for (const width of [1366, 1440, 1920, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/performance");
    await expect(page.getByTestId("projected-purchases")).toBeVisible();
    await page.getByRole("button", { name: /추천 Recommended/ }).click();
    await expect(page.getByTestId("projected-purchases")).toHaveText("124건");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${width}px`).toBe(false);
    if (width === 1440 || width === 390) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `test-results/performance-${width}.png`, fullPage: true });
    }
  }
});
