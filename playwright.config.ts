import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser", fullyParallel: false, workers: 1,
  use: { baseURL: "http://localhost:3100", channel: "msedge", headless: true },
  webServer: { env:{...process.env,GA4_DATA_MODE:"mock",GA4_PROPERTY_ID:"",GA4_PROPERTY_MAP:"",GOOGLE_APPLICATION_CREDENTIALS:""}, command: "node scripts/test-server.cjs", url: "http://localhost:3100", reuseExistingServer: false, timeout: 120000 },
});
