import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateEnvironment,readEnvironment} from "../lib/server/env";
import {MemoryRateLimitStore,rateKey} from "../lib/server/rate-limit";
import {contentSecurityPolicy} from "../lib/security-headers";
test("배포 환경은 PostgreSQL·HTTPS·Secret·Email을 검증하고 값은 오류에 노출하지 않는다",()=>{
 assert.equal(validateEnvironment({APP_ENV:"development"}).appEnv,"development");assert.throws(()=>validateEnvironment({APP_ENV:"staging",DATABASE_URL:"file:./dev.db"}),/Configuration Error/);
 const e={APP_ENV:"staging",DATABASE_URL:"postgresql://example.invalid/db",AUTH_URL:"https://staging.example.invalid",AUTH_SECRET:"x".repeat(48),RESEND_API_KEY:"test-only-marker",AUTH_EMAIL_FROM:"login@example.invalid"};assert.equal(validateEnvironment(e).deployed,true);assert.throws(()=>validateEnvironment({...e,APP_ENV:"production"}),/shared database/);assert.equal(validateEnvironment({...e,APP_ENV:"production",RATE_LIMIT_STORE:"database"}).appEnv,"production");assert.throws(()=>validateEnvironment({...e,AUTH_URL:"http://example.invalid"}),/HTTPS/);assert.equal(readEnvironment({...e}).emailKey,"test-only-marker");
});
test("Rate limit은 만료·독립 키·해시를 보장한다",async()=>{let now=0;const store=new MemoryRateLimitStore(()=>now);const key=rateKey("loginEmail","private@example.invalid");assert.ok(!key.includes("private"));assert.equal((await store.consume(key,2,1000)).allowed,true);assert.equal((await store.consume(key,2,1000)).allowed,true);assert.equal((await store.consume(key,2,1000)).allowed,false);assert.equal((await store.consume("other",2,1000)).allowed,true);now=1001;assert.equal((await store.consume(key,2,1000)).allowed,true)});
test("CSP는 nonce와 동일 출처를 사용하며 외부 광고·메일 주소를 브라우저에 허용하지 않는다",()=>{const value=contentSecurityPolicy("testnonce");assert.match(value,/'nonce-testnonce'/);assert.match(value,/frame-ancestors 'none'/);assert.ok(!value.includes("unsafe-eval"));assert.ok(!value.includes("https:"));assert.ok(!value.includes("resend"));assert.match(contentSecurityPolicy("nonce",true),/unsafe-eval/)});
test("SQLite와 PostgreSQL schema는 provider 외 모델이 동일하다",()=>{const dev=readFileSync("prisma/schema.prisma","utf8"),pg=readFileSync("prisma/postgresql/schema.prisma","utf8");assert.equal(dev.replace('provider = "sqlite"','provider = "postgresql"'),pg);assert.match(pg,/model MutationReceipt/);assert.match(pg,/model RateLimitBucket/);assert.match(pg,/requestId String\?/)});
