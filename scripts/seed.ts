import {PrismaClient} from "@prisma/client";
import seed from "../mock/mock-data.json";
const db=new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL||"file:./dev.db"}}});
async function main(){
if((process.env.APP_ENV??(process.env.NODE_ENV==="production"?"production":"development"))!=="development")throw new Error("Development seed only");
for(const a of seed.advertisers){await db.advertiser.upsert({where:{id:a.id},update:{},create:{id:a.id,name:a.name,industry:a.industry,productName:a.productName,mockData:a}});await db.advertiserConnection.upsert({where:{advertiserId_provider:{advertiserId:a.id,provider:"ga4"}},update:{},create:{advertiserId:a.id,provider:"ga4"}});}
for(const u of [{id:"dev-admin",email:"admin@intentbridge.test",name:"개발 관리자",role:"ADMIN",advertiserId:null},{id:"dev-a",email:"a@intentbridge.test",name:"광고주 A 사용자",role:"ADVERTISER",advertiserId:"brand-a"},{id:"dev-b",email:"b@intentbridge.test",name:"광고주 B 사용자",role:"ADVERTISER",advertiserId:"brand-b"}]){await db.user.upsert({where:{email:u.email},update:{},create:{id:u.id,email:u.email,name:u.name,role:u.role,status:"ACTIVE"}});if(u.advertiserId)await db.advertiserMember.upsert({where:{userId_advertiserId:{userId:u.id,advertiserId:u.advertiserId}},update:{},create:{userId:u.id,advertiserId:u.advertiserId}});}
await db.$disconnect();

}
main().catch(()=>{process.stderr.write("Seed failed. Check DATABASE_URL and migrations.\n");process.exitCode=1;}).finally(()=>db.$disconnect());
