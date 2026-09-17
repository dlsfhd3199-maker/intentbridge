import {forbidden,redirect} from "next/navigation";
import type {Permission} from "@/types/auth";
import {AccessError,requirePermission,requireAdvertiserAccess} from "./authorization";
export async function requirePage(permission:Permission,search?:Promise<Record<string,string|string[]|undefined>>){try{await requirePermission(permission);const query=await search;if(query?.advertiser!==undefined&&typeof query.advertiser!=="string")throw new AccessError(403);if(typeof query?.advertiser==="string")await requireAdvertiserAccess(query.advertiser);}catch(error){if(error instanceof AccessError&&error.status===401)redirect("/login");if(error instanceof AccessError)forbidden();throw error;}}
