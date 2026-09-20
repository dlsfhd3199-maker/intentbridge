import "../globals.css";
import "../product-ui.css";
export const metadata={robots:{index:false,follow:false}};
import {redirect} from "next/navigation";
import {requireUser,AccessError} from "@/lib/server/authorization";
import {WorkspaceBootstrap} from "@/components/workspace-bootstrap";
export const dynamic="force-dynamic";
export default async function WorkspaceLayout({children}:{children:React.ReactNode}){try{await requireUser();}catch(e){if(e instanceof AccessError)redirect("/login");throw e;}return <WorkspaceBootstrap>{children}</WorkspaceBootstrap>;}
