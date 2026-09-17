import {SystemReadiness} from "@/features/admin/readiness";
import {UserManagement,AuditViewer} from "@/features/admin/management";
import {requirePage} from "@/lib/server/page-access";
import {AppSettings} from "@/features/connections/app-settings";
import {DataBackup} from "@/features/connections/data-backup";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) { await requirePage("MANAGE_SETTINGS",searchParams);return <div className="mvp"><SystemReadiness/><UserManagement/><AppSettings/><AuditViewer/><DataBackup/></div>;}
