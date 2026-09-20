import {LoginForm} from "@/components/auth/login-form";
export const dynamic="force-dynamic";
export const metadata={title:"회원가입 | IntentBridge",robots:{index:false,follow:false}};
export default function Signup(){return <LoginForm initialMode="signup"/>;}
