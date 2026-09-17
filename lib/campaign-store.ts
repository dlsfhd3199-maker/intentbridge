import {runtimeScope} from "./runtime-scope";
import {businessStorage,registerStorageReset} from "./server-storage";
import {assertAccess} from "./permissions";
import type { Campaign, CampaignDraft, CampaignEvaluation, CampaignHandoff, CampaignStatus, CampaignStore } from "../types/campaign";
import { campaignChannels, campaignObjectives, frequencyOptions } from "../data/mock/campaign-config";

import { advertisers } from "../data/mock/repository";

const memory = new Map<string, CampaignStore>();
registerStorageReset(()=>memory.clear());
const handoffs = new Map<string, CampaignHandoff>();
export const campaignStoreKey = (advertiserId: string) => `intentbridge:campaigns:v1:${advertiserId}`;
const empty = (): CampaignStore => ({ version: 1, draft: null, drafts: [], versions: [], campaigns: [], lastEdited: null });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 2000): value is string => typeof value === "string" && value.length <= max;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
function validOrigin(value: unknown): boolean {
  if (!record(value)) return false;
  return ["Performance Lab", "Funnel Workspace", "Campaign Studio"].includes(String(value.from)) && text(value.segmentId, 100) && [3,7,14,30].includes(value.window as number) && text(value.createdAt, 100) &&
    typeof value.recommendedBudgetChange === "number" && Number.isFinite(value.recommendedBudgetChange) &&
    (value.scenario === undefined || text(value.scenario, 100)) &&
    (value.levers === undefined || record(value.levers) && Object.values(value.levers).every(v => typeof v === "number" && Number.isFinite(v))) &&
    (value.recommendation === undefined || record(value.recommendation) && text(value.recommendation.title) && text(value.recommendation.id) && finite(value.recommendation.priority) && text(value.recommendation.message)) &&
    (value.forecast === undefined || record(value.forecast) && finite(value.forecast.totalPurchases) && finite(value.forecast.revenue));
}
export function isCampaignDraft(value: unknown, advertiserId: string): value is CampaignDraft {
  if (!record(value) || !record(value.budget) || !record(value.message) || !record(value.origin)) return false;
  const d = value, b = value.budget, m = value.message, o = value.origin;
  return d.advertiserId === advertiserId && text(d.draftId, 100) && text(d.name, 200) && [7, 14, 30].includes(d.period as number) && [3, 7, 14, 30].includes(d.window as number) &&
    campaignChannels.some(channel => channel.id === d.sourceChannelId && channel.source) && campaignChannels.some(channel => channel.id === d.retargetingChannelId && channel.retargeting) &&
    Array.isArray(d.sourceIds) && d.sourceIds.length <= 20 && d.sourceIds.every(id => text(id, 100)) && text(d.segmentId, 100) && campaignObjectives.includes(d.objective as never) && frequencyOptions.some(option => option.id === d.frequency) && typeof d.purchaseExcluded === "boolean" &&
    text(m.headline, 200) && text(m.body, 1000) && text(m.cta, 100) && finite(b.daily) && b.daily <= 1e9 && finite(b.total) && b.total <= 9e8 && finite(b.duration) && Number.isInteger(b.duration) && b.duration <= 90 && ["daily", "total"].includes(String(b.mode)) &&
    validOrigin(o) &&
    text(d.createdAt, 100) && text(d.updatedAt, 100);
}
export function isCampaign(value: unknown, advertiserId: string): value is Campaign {
  if (!isCampaignDraft(value, advertiserId) || !record(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  if (!record(v.forecast) || !record(v.tracking)) return false;
  return text(v.id, 100) && ["DRAFT", "READY", "MOCK ACTIVE", "PAUSED"].includes(String(v.status)) && text(v.audienceName) && finite(v.audienceSize) && text(v.advertiserName) && text(v.tracking.parameters) && text(v.tracking.sourceCampaignId) && text(v.tracking.sourceChannel) && Array.isArray(v.tracking.sourceIds) && v.tracking.sourceIds.every(id => text(id, 100)) &&
    ["reach", "clicks", "purchases", "revenue", "modeledSpend", "unspentBudget", "impressions", "ctr", "cvr", "averageOrderValue"].every(key => finite(v.forecast![key as never])) &&
    ["cpa", "roas"].every(key => v.forecast![key as never] === null || finite(v.forecast![key as never]));
}
export function readCampaignStore(advertiserId: string): CampaignStore { assertAccess(advertiserId);
  const key = campaignStoreKey(advertiserId);
  if (!runtimeScope()&&memory.has(key)) return structuredClone(memory.get(key)!);
  try {
    const raw: unknown = JSON.parse(businessStorage.getItem(key) ?? "null");
    if (record(raw) && raw.version === 1 && Array.isArray(raw.campaigns)) {
      const store: CampaignStore = { drafts: Array.isArray(raw.drafts) ? raw.drafts.filter(d => isCampaignDraft(d, advertiserId)) : [...new Map([...(isCampaignDraft(raw.draft, advertiserId) && !raw.campaigns.some(c => isCampaign(c, advertiserId) && c.draftId === (raw.draft as CampaignDraft).draftId && c.status !== "DRAFT") ? [raw.draft] : []), ...raw.campaigns.filter(c => isCampaign(c, advertiserId) && c.status === "DRAFT")].filter((c): c is CampaignDraft => isCampaignDraft(c, advertiserId)).map(c => [c.draftId, c])).values()], versions: Array.isArray(raw.versions) ? raw.versions.filter(v => record(v) && v.advertiserId === advertiserId && typeof v.id === "string" && typeof v.campaignId === "string" && Number.isInteger(v.version) && finite(v.version) && typeof v.createdAt === "string" && typeof v.reason === "string" && isCampaign(v.snapshot, advertiserId) && v.snapshot.id === v.campaignId) as CampaignStore["versions"] : [], version: 1, draft: isCampaignDraft(raw.draft, advertiserId) ? raw.draft : null, campaigns: raw.campaigns.filter(item => isCampaign(item, advertiserId)), lastEdited: text(raw.lastEdited, 100) ? raw.lastEdited : null };
      if(!runtimeScope())memory.set(key, store); return structuredClone(store);
    }
  } catch { /* Invalid/blocked browser storage starts with an empty safe workspace. */ }
  return empty();
}
function write(advertiserId: string, store: CampaignStore, reason = "Campaign Studio 변경"): "local" | "memory" {
  assertAccess(advertiserId,"MANAGE_CAMPAIGN");
  const key = campaignStoreKey(advertiserId);
  const previous = readCampaignStore(advertiserId);
  store.versions = [...store.versions];
  for (const c of store.campaigns) {
    let versions = store.versions.filter(v => v.campaignId === c.id);
    const before = previous.campaigns.find(p => p.id === c.id);
    if (!versions.length && before) { store.versions.push({id:crypto.randomUUID(),campaignId:c.id,advertiserId,version:1,createdAt:before.updatedAt,reason:"기존 캠페인 보존",snapshot:structuredClone(before)}); versions = store.versions.filter(v => v.campaignId === c.id); }
    if (!versions.length || JSON.stringify(versions.at(-1)!.snapshot) !== JSON.stringify(c)) store.versions.push({id:crypto.randomUUID(),campaignId:c.id,advertiserId,version:(versions.at(-1)?.version ?? 0)+1,createdAt:c.updatedAt,reason,snapshot:structuredClone(c)});
  }
  memory.set(key, structuredClone(store));
  try { businessStorage.setItem(key, JSON.stringify(store)); return "local"; } catch { return "memory"; }
}
export function persistCampaignDraft(draft: CampaignDraft): "local" | "memory" {
  if (!isCampaignDraft(draft, draft.advertiserId)) throw new Error("유효하지 않은 캠페인 초안입니다.");
  const store = readCampaignStore(draft.advertiserId);
  return write(draft.advertiserId, { ...store, draft, drafts: store.campaigns.some(c => c.draftId === draft.draftId && c.status !== "DRAFT") ? store.drafts : [draft, ...store.drafts.filter(d => d.draftId !== draft.draftId)], lastEdited: draft.updatedAt });
}
export function saveCampaign(draft: CampaignDraft, evaluation: CampaignEvaluation, advertiserName: string, ready = false): Campaign { assertAccess(draft.advertiserId,"MANAGE_CAMPAIGN");
  if (!isCampaignDraft(draft, draft.advertiserId)) throw new Error("초안 형식을 확인하세요.");
  if (ready && !evaluation.ready) throw new Error("Automation Preview의 준비 조건을 확인하세요.");
  const store = readCampaignStore(draft.advertiserId);
  const existing = store.campaigns.find(item => item.draftId === draft.draftId);
  if (existing && existing.status !== "DRAFT") return existing; // Idempotent create: further edits fork a new draft in the editor.
  const now = new Date().toISOString();
  const id = ready ? `IB-${draft.retargetingChannelId.toUpperCase()}-${now.slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}` : existing?.id ?? `DRAFT-${draft.draftId}`;
  const campaign: Campaign = { ...structuredClone(draft), updatedAt: now, id, status: ready ? "READY" : "DRAFT", advertiserName, audienceName: evaluation.segmentName, audienceSize: evaluation.audience, forecast: evaluation.forecast, tracking: evaluation.tracking };
  write(draft.advertiserId, { ...store, version: 1, draft: campaign, drafts: ready ? store.drafts.filter(d => d.draftId !== draft.draftId) : [draft,...store.drafts.filter(d => d.draftId !== draft.draftId)], campaigns: [campaign, ...store.campaigns.filter(item => item.draftId !== draft.draftId)], lastEdited: now });
  return campaign;
}
export function changeCampaignStatus(advertiserId: string, id: string, status: CampaignStatus): Campaign {
  const store = readCampaignStore(advertiserId);
  const campaign = store.campaigns.find(item => item.id === id);
  if (!campaign) throw new Error("캠페인을 찾지 못했습니다.");
  const allowed = campaign.status === "READY" || campaign.status === "PAUSED" ? status === "MOCK ACTIVE" : campaign.status === "MOCK ACTIVE" ? status === "PAUSED" : false;
  if (!allowed) throw new Error("허용되지 않는 Mock 상태 전환입니다.");
  const updated = { ...campaign, status, updatedAt: new Date().toISOString() };
  write(advertiserId, { ...store, campaigns: store.campaigns.map(item => item.id === id ? updated : item), lastEdited: updated.updatedAt });
  return updated;
}
export function saveCampaignHandoff(handoff: CampaignHandoff): string { assertAccess(handoff.advertiserId,"MANAGE_CAMPAIGN");
  handoffs.set(handoff.id, structuredClone(handoff));
  try { businessStorage.setItem(`intentbridge:campaign-handoff:${handoff.id}`, JSON.stringify(handoff)); } catch { /* Same-tab handoff remains available in memory. */ }
  return `/campaigns?${new URLSearchParams({ advertiser: handoff.advertiserId, period: String(handoff.period), handoff: handoff.id })}`;
}
export function readCampaignHandoff(id: string): CampaignHandoff | null { assertAccess(undefined,"MANAGE_CAMPAIGN");
  if (handoffs.has(id)) return structuredClone(handoffs.get(id)!);
  try {
    const raw = JSON.parse(businessStorage.getItem(`intentbridge:campaign-handoff:${id}`) ?? "null");
    if (record(raw) && raw.id === id && advertisers.some(a => a.id === raw.advertiserId) && [7, 14, 30].includes(raw.period as number) && validOrigin(raw.origin) &&
      campaignChannels.some(c => c.id === raw.sourceChannelId && c.source) && campaignChannels.some(c => c.id === raw.retargetingChannelId && c.retargeting) &&
      Array.isArray(raw.sourceIds) && raw.sourceIds.length <= 20 && raw.sourceIds.every(item => text(item, 100))) return raw as unknown as CampaignHandoff;
  } catch { /* Missing or corrupt handoffs do not replace the current draft. */ }
  return null;
}

export function replaceMockCampaign(campaign: Campaign, reason: string): void {
  if (!isCampaign(campaign,campaign.advertiserId)) throw new Error("잘못된 Campaign 상태입니다.");
  const store = readCampaignStore(campaign.advertiserId);
  if (!store.campaigns.some(c => c.id === campaign.id)) throw new Error("삭제되었거나 존재하지 않는 Campaign입니다.");
  write(campaign.advertiserId,{...store,campaigns:store.campaigns.map(c => c.id === campaign.id ? campaign : c),draft:store.draft?.draftId === campaign.draftId ? campaign : store.draft,lastEdited:campaign.updatedAt},reason);
}
export function duplicateDraft(draft: CampaignDraft): CampaignDraft { assertAccess(draft.advertiserId,"MANAGE_CAMPAIGN");
  const copy = {...structuredClone(draft),draftId:crypto.randomUUID(),name:draft.name.slice(0,185)+" 복사",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  persistCampaignDraft(copy); return copy;
}
export function deleteDraft(advertiserId:string,id:string) {
  const store = readCampaignStore(advertiserId);
  if (!store.drafts.some(d => d.draftId === id)) throw new Error("초안을 찾을 수 없습니다.");
  write(advertiserId,{...store,drafts:store.drafts.filter(d => d.draftId !== id),draft:store.draft?.draftId === id ? null : store.draft,campaigns:store.campaigns.filter(c => !(c.draftId === id && c.status === "DRAFT")),lastEdited:new Date().toISOString()},"초안 삭제");
}

// Called only after whole-backup validation; avoids generating new versions during restore.
export function restoreCampaignStore(advertiserId:string,store:CampaignStore){assertAccess(advertiserId,"MANAGE_CAMPAIGN");memory.set(campaignStoreKey(advertiserId),structuredClone(store));try{businessStorage.setItem(campaignStoreKey(advertiserId),JSON.stringify(store));return "local" as const;}catch{return "memory" as const;}}
