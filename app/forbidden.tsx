import Link from "next/link";
import {AuthFrame} from "@/components/auth/auth-frame";
export default function Forbidden(){return <AuthFrame><h2>이 페이지에 접근할 권한이 없습니다.</h2><p>접근 가능한 워크스페이스에서 업무를 이어가세요.</p><Link className="auth-primary" href="/dashboard">대시보드로 이동</Link><p className="auth-help">관리자 문의 · 워크스페이스 담당 관리자에게 접근 권한을 요청해 주세요.</p></AuthFrame>}
