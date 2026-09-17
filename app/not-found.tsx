import Link from "next/link";
export default function NotFound() { return <section className="light-panel"><h2>요청하신 페이지가 없습니다.</h2><Link href="/" className="back-link">홈 대시보드로 돌아가기 →</Link></section>; }
