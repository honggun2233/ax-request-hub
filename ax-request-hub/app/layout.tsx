import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Sidebar from "@/components/Sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "삼성AM AI Hub",
  description: "삼성자산운용 AI 허브 포털",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="ko">
      <body className="bg-gray-50">
        <Providers>
          {session ? (
            <div className="flex">
              <Sidebar />
              <main className="ml-60 flex-1 min-h-screen p-6">{children}</main>
            </div>
          ) : (
            <main className="min-h-screen">{children}</main>
          )}
        </Providers>
      </body>
    </html>
  );
}
