import {readWorkspace} from "@/lib/server/workspace-repository";
import {apiError} from "@/lib/server/authorization";
export async function GET(_request:Request,{params}:{params:Promise<{advertiserId:string}>}){try{return Response.json(await readWorkspace((await params).advertiserId),{headers:{"Cache-Control":"no-store"}});}catch(e){return apiError(e);}}
