import {runtimeScope} from "./runtime-scope";
import type {Permission,SessionUser,UserRole} from "../types/auth";
const advertiserPermissions:Permission[]=["VIEW_OWN_ADVERTISER","VIEW_CAMPAIGN","VIEW_REPORT"];
export function can(role:UserRole,permission:Permission){return role==="admin"||advertiserPermissions.includes(permission);}
export function canAccessAdvertiser(user:SessionUser,id:string){return can(user.role,"VIEW_ALL_ADVERTISERS")||(user.advertiserIds??[user.advertiserId]).includes(id);}
export function requirePermission(user:SessionUser,permission:Permission){if(!can(user.role,permission))throw new Error("이 기능은 관리자 전용입니다.");}
export function requireAdvertiser(user:SessionUser,id:string){if(!canAccessAdvertiser(user,id))throw new Error("자신의 광고주만 조회할 수 있습니다.");}
// Pure test/development view model only; server authorization always resolves a DB session.
export const mockUser=(role:UserRole):SessionUser=>({id:"qa-user",role,advertiserId:"brand-a",source:"mock"});
let resolvedUser:SessionUser|undefined;
export function installSessionUser(user:SessionUser){resolvedUser=user;}
export function currentUser():SessionUser {if(runtimeScope())return runtimeScope()!.user;if(resolvedUser)return resolvedUser;if(typeof window==="undefined")return mockUser("admin");throw new Error("로그인이 필요합니다.");}
export function setMockRole(role:UserRole){if(resolvedUser?.source==="session"&&process.env.NODE_ENV!=="development")return;resolvedUser=resolvedUser?.source==="session"?{...resolvedUser,role}:mockUser(role);}
export function assertAccess(advertiserId?:string,permission?:Permission,user=currentUser()){if(permission)requirePermission(user,permission);if(advertiserId)requireAdvertiser(user,advertiserId);}
