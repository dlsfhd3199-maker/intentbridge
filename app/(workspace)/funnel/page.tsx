import {requirePage} from "@/lib/server/page-access";
import { FunnelWorkspace } from "@/features/funnel/funnel-workspace";
export const metadata = { title: "Funnel Workspace · IntentBridge" };
export default async function FunnelPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { await requirePage("VIEW_OWN_ADVERTISER",searchParams); return <FunnelWorkspace/>; }
