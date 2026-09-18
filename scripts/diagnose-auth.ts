import {PrismaClient} from "@prisma/client";
import {loadEnvConfig} from "@next/env";
import {emailLoginDecision,emailLoginAllowed,safeAuthError} from "../lib/auth-diagnostics";
loadEnvConfig(process.cwd());
async function main(){
 if(!process.env.DATABASE_URL){process.stdout.write(JSON.stringify({event:"auth.diagnosis.failed",category:"MissingDatabaseUrl"})+"\n");process.exitCode=1;return;}
 let db:PrismaClient|undefined;
 try{
  db=new PrismaClient({datasourceUrl:process.env.DATABASE_URL});
  const [users,activeAdmins,activeUsers,invitedUsers,disabledUsers,advertisers,memberships,verificationTokens,sessions]=await db.$transaction([
   db.user.count(),db.user.count({where:{role:"ADMIN",status:"ACTIVE"}}),db.user.count({where:{status:"ACTIVE"}}),db.user.count({where:{status:"INVITED"}}),db.user.count({where:{status:"DISABLED"}}),db.advertiser.count(),db.advertiserMember.count(),db.verificationToken.count(),db.session.count(),
  ]);
  const email=(process.env.AUTH_DIAGNOSTIC_EMAIL??process.env.INITIAL_ADMIN_EMAIL)?.trim().toLowerCase();
  const user=email?await db.user.findUnique({where:{email},select:{status:true,invitations:{select:{acceptedAt:true,expiresAt:true}}}}):null;
  const decision=email?emailLoginDecision(user):undefined;
  process.stdout.write(JSON.stringify({event:"auth.diagnosis",counts:{users,activeAdmins,activeUsers,invitedUsers,disabledUsers,advertisers,memberships,verificationTokens,sessions},initialAdminNeeded:activeAdmins===0,target:decision?{exists:!!user,allowed:emailLoginAllowed(decision),reason:decision}:"not_selected"})+"\n");
 }catch(error){process.stdout.write(JSON.stringify({event:"auth.diagnosis.failed",...safeAuthError(error)})+"\n");process.exitCode=1;}
 finally{await db?.$disconnect();}
}
void main();
