import {requirePage} from "@/lib/server/page-access";
import { Overview } from "@/features/dashboard/overview";
export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { await requirePage("VIEW_OWN_ADVERTISER",searchParams); return <Overview/>; }
