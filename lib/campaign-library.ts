import type { Campaign } from "../types/campaign";
import { readCampaignStore } from "./campaign-store";
import { evaluateCampaign, loadCampaignWorkspace } from "./campaign-service";
export async function loadCampaignPlans(advertiserId:string):Promise<Campaign[]> {
  const store=readCampaignStore(advertiserId);
  const contexts=new Map(await Promise.all([...new Set(store.drafts.map(d=>d.period))].map(async period=>[period,await loadCampaignWorkspace({advertiserId,period})] as const)));
  const drafts=store.drafts.map(d=>{const ctx=contexts.get(d.period)!,e=evaluateCampaign(d,ctx);return {...d,id:`DRAFT-${d.draftId}`,status:"DRAFT" as const,advertiserName:ctx.advertiser.name,audienceName:e.segmentName,audienceSize:e.audience,forecast:e.forecast,tracking:e.tracking};});
  return [...store.campaigns.filter(c=>c.status!=="DRAFT"),...drafts];
}
