import {requirePage} from "@/lib/server/page-access";
import { Suspense } from "react";
import { CampaignStudio } from "@/features/campaigns/campaign-studio";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { await requirePage("VIEW_CAMPAIGN",searchParams); return <Suspense fallback={<p>Campaign Studio 준비 중…</p>}><CampaignStudio/></Suspense>; }
