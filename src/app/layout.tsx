import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "DURE",
  description: "교육 운영 관리 워크스페이스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
