import { campaignTemplates } from "../data/mock/campaign-config";
import type { AudienceSegment, FunnelWorkspaceData } from "../types/funnel";
import type { CampaignMessage } from "../types/campaign";

export function recommendCampaignMessage(segment: AudienceSegment, funnel: FunnelWorkspaceData): CampaignMessage {
  const template = campaignTemplates[segment.event];
  const bottleneck = funnel.bottleneck?.id;
  const extra = segment.event === "AddToCart" && bottleneck === "AddToCart" ? "상품 정보와 후기를 함께 살펴보세요." : segment.event === "BeginCheckout" && bottleneck === "Purchase" ? "배송 정보와 결제 방법도 다시 확인할 수 있어요." : "궁금한 상품 정보를 다시 만나보세요.";
  return { headline: template.headline, body: `${funnel.advertiser.productName}. ${template.body} ${extra}`, cta: template.cta };
}
