import "server-only";
import {PrismaClient} from "@prisma/client";
const globalDB=globalThis as unknown as {intentbridgeDB?:PrismaClient};
export const db=globalDB.intentbridgeDB??new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL||"file:./dev.db"}}});
if(process.env.NODE_ENV!=="production")globalDB.intentbridgeDB=db;
