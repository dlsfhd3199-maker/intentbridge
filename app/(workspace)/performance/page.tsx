import {requirePage} from "@/lib/server/page-access";
import { PerformanceLab } from "@/features/performance/performance-lab";
export const metadata = { title: "Performance Lab · IntentBridge" };
export default async function PerformancePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { await requirePage("VIEW_OWN_ADVERTISER",searchParams); return <PerformanceLab/>; }
