import type { CampaignDraft, CampaignTracking } from "../types/campaign";
const token = (value: string) => value.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "").slice(0, 80);
export function campaignName(draft: Pick<CampaignDraft, "retargetingChannelId" | "objective" | "segmentId" | "window" | "advertiserId">): string {
  return `IB_${token(draft.retargetingChannelId)}_${token(draft.objective)}_${token(draft.segmentId.split("-")[0])}_${draft.window}D_${token(draft.advertiserId)}`.toUpperCase();
}
export function campaignTracking(draft: CampaignDraft, sourceCampaignId: string): CampaignTracking {
  const params = new URLSearchParams({ utm_source: draft.retargetingChannelId, utm_medium: "paid_retargeting", utm_campaign: token(draft.name).toLowerCase(), utm_content: `${token(draft.segmentId)}_${draft.window}d` });
  return { parameters: params.toString(), sourceCampaignId, sourceChannel: draft.sourceChannelId, sourceIds: [...draft.sourceIds] };
}
