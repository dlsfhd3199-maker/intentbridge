// Explicit operator-only migration for existing accounts; no role/status changes or resets.
import {PrismaClient} from "@prisma/client";
import {hashPassword,passwordProblem,normalizeEmail,validEmail} from "../lib/password";
const db=new PrismaClient({datasourceUrl:process.env.DATABASE_URL});
async function main(){const email=normalizeEmail(process.env.AUTH_PASSWORD_EMAIL),password=process.env.AUTH_INITIAL_PASSWORD;
 if(!process.env.DATABASE_URL||!validEmail(email)||!password||password.length<12||passwordProblem(password))throw new Error();
 const passwordHash=await hashPassword(password);await db.$transaction(async tx=>{const user=await tx.user.findUnique({where:{email}});if(!user||user.passwordHash)throw new Error();await tx.user.update({where:{id:user.id},data:{passwordHash}});await tx.session.deleteMany({where:{userId:user.id}});await tx.auditLog.create({data:{actorUserId:"operator",action:"user.password.initialized",resource:user.id}});},{isolationLevel:"Serializable"});process.stdout.write("Password initialized; role and status unchanged.\n");}
main().catch(()=>{process.stderr.write("Password initialization refused. Check environment and existing account state.\n");process.exitCode=1}).finally(()=>db.$disconnect());
