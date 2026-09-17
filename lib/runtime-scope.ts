import type fixture from "../mock/mock-data.json";
import type {Advertiser} from "../types/domain";
import type {SessionUser} from "../types/auth";
export interface RuntimeScope {fixtures:typeof fixture;advertisers:Advertiser[];user:SessionUser;documents:Map<string,string>}
let resolver:(()=>RuntimeScope|undefined)|undefined;
// Server installs a request-local resolver, never a shared mutable user/data snapshot.
export function installScopeResolver(value:()=>RuntimeScope|undefined){resolver=value}
export const runtimeScope=()=>resolver?.();
