import test from "node:test";
import assert from "node:assert/strict";
import {hashPassword,passwordProblem,verifyPassword} from "../lib/password";
import {validateEnvironment} from "../lib/server/env";
test("Argon2id는 무작위 salt·올바른 검증·손상 해시/잘못된 비밀번호 거부",async()=>{const value="Test-only-password-123!",a=await hashPassword(value),b=await hashPassword(value);assert.match(a,/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);assert.notEqual(a,b);assert.equal(await verifyPassword(a,value),true);assert.equal(await verifyPassword(a,"incorrect"),false);assert.equal(await verifyPassword(null,value),false);assert.equal(await verifyPassword("corrupt",value),false);assert.ok(!a.includes(value));});
test("비밀번호 입력 한계와 배포 시 Resend 비필수",()=>{assert.ok(passwordProblem("short"));assert.ok(passwordProblem("password123"));assert.ok(passwordProblem("x".repeat(129)));assert.equal(passwordProblem("Strong-test-123!"),null);assert.equal(validateEnvironment({APP_ENV:"staging",DATABASE_URL:"postgresql://example.invalid/db",AUTH_URL:"https://example.invalid",AUTH_SECRET:"x".repeat(48)}).appEnv,"staging");});
