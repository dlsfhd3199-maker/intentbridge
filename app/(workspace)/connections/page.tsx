import {requirePage} from "@/lib/server/page-access";
import { ConnectionCenter } from "@/features/connections/connection-center";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { await requirePage("MANAGE_CONNECTIONS",searchParams);return <ConnectionCenter/>;}
