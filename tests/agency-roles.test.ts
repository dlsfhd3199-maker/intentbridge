import test from "node:test";
import assert from "node:assert/strict";
import {can,canAccessAdvertiser,roleFromDatabase} from "../lib/permissions";
import {canAccessRoute} from "../lib/route-permissions";
import type {SessionUser,Permission} from "../types/auth";
test("MANAGER는 배정된 N:N workspace 운영과 연결 조회만 허용된다",()=>{
 const manager:SessionUser={id:"m",role:"manager",advertiserId:"a",advertiserIds:["a","b"],source:"session"};
 for(const permission of ["MANAGE_CAMPAIGN","MANAGE_OPERATIONS","VIEW_CONNECTIONS","VIEW_WORKSPACE_SUMMARIES"] as Permission[])assert.equal(can(manager.role,permission),true);
 for(const permission of ["VIEW_ALL_ADVERTISERS","MANAGE_SETTINGS","MANAGE_ADVERTISER","MANAGE_CONNECTIONS"] as Permission[])assert.equal(can(manager.role,permission),false);
 for(const route of ["/dashboard","/funnel","/performance","/campaigns","/operations","/reports","/connections"])assert.equal(canAccessRoute(manager,route),true);
 for(const route of ["/settings","/advertisers"])assert.equal(canAccessRoute(manager,route),false);
 assert.equal(canAccessAdvertiser(manager,"a"),true);assert.equal(canAccessAdvertiser(manager,"b"),true);assert.equal(canAccessAdvertiser(manager,"c"),false);
 assert.equal(can("advertiser","MANAGE_CAMPAIGN"),false);assert.equal(can("advertiser","VIEW_CONNECTIONS"),false);assert.equal(can("super_admin","MANAGE_SETTINGS"),true);
 assert.equal(roleFromDatabase("ADMIN"),undefined);assert.equal(roleFromDatabase("__proto__"),undefined);assert.equal(roleFromDatabase("MANAGER"),"manager");
});
