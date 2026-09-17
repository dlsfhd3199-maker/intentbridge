import type { CampaignChannel, CampaignObjective, FrequencyCap, MessageTemplate } from "../../types/campaign";
import type { BehaviorEvent } from "../../types/funnel";

export const campaignChannels: CampaignChannel[] = [
  { id: "chatgpt", name: "ChatGPT", source: true, retargeting: false, capability: { status: "Mock", forecast: true, create: false }, previewLabel: "Mock Feed Preview", cpm: 14000 },
  { id: "meta", name: "Meta", source: true, retargeting: true, capability: { status: "Mock", forecast: true, create: true }, previewLabel: "Meta Feed Preview", cpm: 14000 },
  ...["naver", "google", "kakao", "youtube", "affiliate", "crm", "other"].map(id => ({ id, name: ({ naver: "Naver", google: "Google", kakao: "Kakao", youtube: "YouTube", affiliate: "Affiliate", crm: "CRM", other: "Other" } as Record<string, string>)[id], source: true, retargeting: ["naver", "google", "kakao", "other"].includes(id), capability: { status: "Coming Soon" as const, forecast: false, create: false }, previewLabel: "Mock Creative Preview", cpm: 0 })),
];
export const campaignObjectives: CampaignObjective[] = ["Purchase", "Recover Cart", "Recover Checkout", "Revisit Product", "Lead", "Custom"];
export const frequencyOptions: { id: FrequencyCap; label: string }[] = [{ id: "daily-1", label: "1 / Day" }, { id: "daily-2", label: "2 / Day" }, { id: "weekly-3", label: "3 / Week" }, { id: "unlimited", label: "No Limit (Mock 5 / Day)" }];
export const campaignTemplates: Record<BehaviorEvent, MessageTemplate> = {
  ViewContent: { headline: "아직 비교 중이신가요?", body: "관심 있게 보신 제품을 다시 확인해보세요.", cta: "제품 다시 보기", objective: "Revisit Product", frequency: "weekly-3", ctr: .035, cvr: .10 },
  AddToCart: { headline: "장바구니에 담아둔 상품이 있어요", body: "구매 전 마지막으로 배송과 혜택을 확인해보세요.", cta: "장바구니 확인", objective: "Recover Cart", frequency: "daily-1", ctr: .045, cvr: .16 },
  BeginCheckout: { headline: "구매를 완료하지 않으셨나요?", body: "결제 중 멈춘 상품을 이어서 확인해보세요.", cta: "구매 계속하기", objective: "Purchase", frequency: "daily-2", ctr: .05, cvr: .22 },
};
