import type {Metadata} from "next";
import "./globals.css";
import "./product-ui.css";
export const metadata:Metadata={title:"IntentBridge",description:"광고 데이터를 구매까지 연결합니다."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
