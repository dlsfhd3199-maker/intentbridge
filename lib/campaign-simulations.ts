import { readSimulationLibrary } from "./simulation-library";
import { listSimulationSettings } from "./simulation/store";
import { loadPerformanceBaseline } from "./simulation/baseline";
import { simulate } from "./simulation";
import { getRecommendations } from "./recommendations";
import type { SavedCampaignSimulation } from "../types/campaign";

export async function savedCampaignSimulations(advertiserId: string): Promise<SavedCampaignSimulation[]> {
  const automatic = await Promise.all(listSimulationSettings(advertiserId).map(async entry => {
    const baseline = await loadPerformanceBaseline({ advertiserId, period: entry.period });
    const forecast = simulate(baseline, entry.levers);
    return { id: entry.key, label: `${entry.scenario} · ${entry.period}일 · 저장된 Simulation`, baseline, levers: entry.levers, forecast, recommendation: getRecommendations(baseline, forecast)[0] ?? null };
  }));
  const named = readSimulationLibrary(advertiserId).map(s => ({ id: s.id, label: `${s.name} · ${s.period}일`, baseline: s.baseline, levers: s.levers, forecast: s.forecast, recommendation: getRecommendations(s.baseline, s.forecast)[0] ?? null }));
  return [...automatic, ...named];
}
