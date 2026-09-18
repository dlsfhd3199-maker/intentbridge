import {hash,verify} from "@node-rs/argon2";
import {randomBytes} from "node:crypto";
export function passwordProblem(value:unknown){
 if(typeof value!=="string"||value.length>128)return "입력 내용을 확인해주세요.";
 if(value.length<8)return "비밀번호가 너무 짧습니다. 8자 이상 입력해주세요.";
 if(/^(.)\1+$/.test(value)||["password","password123","12345678","123456789","qwerty123"].includes(value.toLowerCase()))return "쉽게 추측할 수 없는 비밀번호를 입력해주세요.";
 return null;
}
export const hashPassword=(password:string)=>hash(password,{algorithm:2 /* Argon2id */,memoryCost:19456,timeCost:2,parallelism:1,outputLen:32});
let dummy:Promise<string>|undefined;
export async function verifyPassword(encoded:string|null,password:string){
 const target=encoded??await(dummy??=hashPassword(randomBytes(32).toString("hex")));
 try{return await verify(target,password)&&!!encoded;}catch{return false;}
}
export const normalizeEmail=(value:unknown)=>typeof value==="string"?value.trim().toLowerCase():"";
export const validEmail=(value:string)=>value.length<=254&&/^[-a-z0-9._+]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
