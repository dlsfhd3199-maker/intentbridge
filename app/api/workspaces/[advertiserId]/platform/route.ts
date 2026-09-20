import {readPlatform,changePlatform} from '@/lib/server/platform-repository';
import {apiError,sameOrigin} from '@/lib/server/authorization';
import {jsonInput} from '@/lib/server/input';
import {withRequest} from '@/lib/server/request-context';
type Context={params:Promise<{advertiserId:string}>};
export async function GET(r:Request,c:Context){return withRequest(r,async()=>{try{return Response.json(await readPlatform((await c.params).advertiserId),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}});}
export async function PATCH(r:Request,c:Context){return withRequest(r,async()=>{try{sameOrigin(r);return Response.json(await changePlatform((await c.params).advertiserId,await jsonInput(r,12000)));}catch(e){return apiError(e);}});}
