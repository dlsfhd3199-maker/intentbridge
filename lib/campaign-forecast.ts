import type { CampaignBudget, CampaignForecast, CampaignForecastInput } from "../types/campaign";
import { calculateFinancialMetrics } from "./simulation";
const safe = (value: number, max = 1e9) => Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;

export function changeCampaignBudget(current: CampaignBudget, field: "daily" | "total" | "duration", value: number): CampaignBudget {
  const duration = field === "duration" ? Math.floor(safe(value, 90)) : current.duration;
  const mode = field === "duration" ? current.mode : field;
  const amount = safe(field === "duration" ? current[mode] : value, mode === "daily" ? 1e7 : 9e8);
  return mode === "daily" ? { daily: Math.round(amount), duration, total: Math.round(amount * duration), mode } : { total: Math.round(amount), duration, daily: duration ? Math.round(amount / duration * 100) / 100 : 0, mode };
}

export function forecastCampaign(input: CampaignForecastInput): CampaignForecast {
  const audience = Math.floor(safe(input.audience, 1e7)), budget = safe(input.budget), duration = Math.floor(safe(input.duration, 90));
  const ctr = safe(input.ctr, 1), cvr = safe(input.cvr, 1), averageOrderValue = safe(input.averageOrderValue);
  const frequency = input.frequency === "daily-1" ? duration : input.frequency === "daily-2" ? duration * 2 : input.frequency === "weekly-3" ? Math.ceil(duration * 3 / 7) : duration * 5;
  // Synthetic delivery: CPM buys impressions, capped by audience × period frequency.
  const impressions = duration > 0 && input.cpm > 0 ? Math.min(audience * frequency, Math.floor(budget / input.cpm * 1000)) : 0;
  const reach = frequency ? Math.min(audience, Math.ceil(impressions / frequency)) : 0;
  const clicks = Math.min(reach, Math.round(impressions * ctr));
  const purchases = Math.min(clicks, Math.round(clicks * cvr));
  const modeledSpend = Math.min(budget, Math.round(impressions * safe(input.cpm) / 1000));
  const financials = calculateFinancialMetrics(purchases, purchases * averageOrderValue, modeledSpend);
  return { label: "DEMO FORECAST", impressions, reach, clicks, purchases, revenue: financials.revenue, cpa: financials.cpa, roas: financials.roas, modeledSpend, unspentBudget: Math.max(0, budget - modeledSpend), ctr, cvr, averageOrderValue };
}
