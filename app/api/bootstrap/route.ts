import {bootstrap} from "@/lib/server/workspace-repository";
import {apiError} from "@/lib/server/authorization";
export const dynamic="force-dynamic";
export async function GET(){try{return Response.json(await bootstrap(),{headers:{"Cache-Control":"no-store"}});}catch(e){return apiError(e);}}
