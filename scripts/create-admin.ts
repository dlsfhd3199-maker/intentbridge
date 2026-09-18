import {PrismaClient} from "@prisma/client";
import {hashPassword,passwordProblem,normalizeEmail,validEmail} from "../lib/password";
const db=new PrismaClient({datasourceUrl:process.env.DATABASE_URL||"file:./dev.db"});
async function main(){
 const email=normalizeEmail(process.env.INITIAL_ADMIN_EMAIL),password=process.env.INITIAL_ADMIN_PASSWORD;
 if(!validEmail(email)||!password||password.length<12||passwordProblem(password))throw new Error("Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (12+ characters).");
 const passwordHash=await hashPassword(password);
 await db.$transaction(async tx=>{
  const existing=await tx.user.findUnique({where:{email}}),admins=await tx.user.count({where:{role:"ADMIN",status:"ACTIVE"}});
  if(existing){if(existing.role!=="ADMIN"||existing.status!=="ACTIVE"||existing.passwordHash||admins!==1)throw new Error("Admin bootstrap refused. Use existing account management.");await tx.user.update({where:{id:existing.id},data:{passwordHash}});await tx.session.deleteMany({where:{userId:existing.id}});await tx.auditLog.create({data:{actorUserId:existing.id,action:"admin.password.initialized",resource:existing.id}});}
  else{if(admins)throw new Error("Admin bootstrap refused. Use existing account management.");const user=await tx.user.create({data:{email,passwordHash,name:"관리자",role:"ADMIN",status:"ACTIVE"}});await tx.auditLog.create({data:{actorUserId:user.id,action:"admin.created",resource:user.id}});}
 },{isolationLevel:"Serializable"});process.stdout.write("Admin ready. Sign in with email and password.\n");
}
main().catch(e=>{process.stderr.write(e instanceof Error&&/^(Set INITIAL_ADMIN_|Admin bootstrap refused)/.test(e.message)?e.message+"\n":"Admin setup failed.\n");process.exitCode=1}).finally(()=>db.$disconnect());
