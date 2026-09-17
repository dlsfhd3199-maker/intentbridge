import {adminWorkspaceSummaries} from "@/lib/server/summary";
import {AccessError,apiError} from "@/lib/server/authorization";
import {withRequest} from "@/lib/server/request-context";
export async function GET(r:Request){return withRequest(r,async()=>{try{const period=Number(new URL(r.url).searchParams.get("period")??30);if(![7,14,30].includes(period))throw new AccessError(400);return Response.json(await adminWorkspaceSummaries(period as 7|14|30));}catch(e){return apiError(e)}})}
