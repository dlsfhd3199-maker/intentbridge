"use client";
import {authStyles} from "@/lib/auth-presentation";
import Link from "next/link";
export function AccessDenied({workspace=false}:{workspace?:boolean}){return <section className="auth-notice" role="alert"><style>{authStyles}</style><h2>{workspace?"자신의 광고주만 조회할 수 있습니다.":"이 기능은 관리자 전용입니다."}</h2><p>접근 가능한 화면에서 성과를 확인해 주세요.</p><Link href="/">대시보드로 이동</Link></section>;}
