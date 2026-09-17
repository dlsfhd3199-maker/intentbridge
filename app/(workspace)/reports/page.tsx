import {requirePage} from "@/lib/server/page-access";
import { ExecutiveReport } from "@/features/reports/executive-report";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { await requirePage("VIEW_REPORT",searchParams);return <ExecutiveReport/>;}
