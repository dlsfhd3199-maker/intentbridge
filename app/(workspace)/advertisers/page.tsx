import {AdvertiserManagement} from "@/features/admin/management";
import {requirePage} from "@/lib/server/page-access";
import {AdminDashboard} from "@/features/dashboard/admin-dashboard";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { await requirePage("MANAGE_ADVERTISER",searchParams);return <><AdminDashboard management/><div className="mvp"><AdvertiserManagement/></div></>;}
