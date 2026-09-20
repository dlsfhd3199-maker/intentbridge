import {WorkspaceAdvertiserManagement as AdvertiserManagement} from "@/features/admin/advertiser-management";
import {requirePage} from "@/lib/server/page-access";

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { await requirePage("MANAGE_ADVERTISER",searchParams);return <AdvertiserManagement/>;}
