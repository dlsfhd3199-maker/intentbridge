import {requirePage} from "@/lib/server/page-access";
import { OperationsCenter } from "@/features/operations/operations-center";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { await requirePage("MANAGE_OPERATIONS",searchParams);return <OperationsCenter/>;}
