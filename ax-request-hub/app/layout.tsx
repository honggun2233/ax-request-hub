import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppSidebar } from "@/components/app-sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Role } from "@/lib/authz";

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
  const role = ((session?.user as any)?.role ?? "EMPLOYEE") as Role;
  return (
    <html lang="ko">
      <body className="bg-[#111827]">
        <Providers>
          {session ? (
            <div className="flex">
              <aside className="w-[248px] h-screen fixed top-0 left-0 z-10">
                <AppSidebar role={role} />
              </aside>
              <main className="ml-[248px] flex-1 min-h-screen p-6 text-[#D4DDE8]">{children}</main>
            </div>
          ) : (
            <main className="min-h-screen">{children}</main>
          )}
        </Providers>
      </body>
    </html>
  );
}
