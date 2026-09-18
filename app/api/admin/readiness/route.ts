import {requirePermission,apiError} from "@/lib/server/authorization";
import {db} from "@/lib/server/database";
import {readEnvironment} from "@/lib/server/env";
import {withRequest} from "@/lib/server/request-context";
export async function GET(r:Request){return withRequest(r,async()=>{try{await requirePermission("MANAGE_SETTINGS");const e=readEnvironment();let database="UNAVAILABLE";try{await db.$queryRaw`SELECT 1`;database="READY"}catch{}return Response.json({environment:e.appEnv.toUpperCase(),database,authentication:e.authSecret&&e.authUrl?"CONFIGURED":"DEVELOPMENT",email:e.emailKey&&e.emailFrom?"CONFIGURED · DELIVERY NOT VERIFIED":"OPTIONAL · NOT CONFIGURED",ga4:"MOCK / REAL LOCAL ONLY",storage:"DATABASE · ATOMIC BATCH",rateLimit:e.rateStore==="database"?"SHARED DATABASE":"SINGLE INSTANCE MEMORY",campaign:"MOCK",operations:"MOCK"})}catch(e){return apiError(e)}})}
