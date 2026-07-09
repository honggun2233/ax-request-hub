import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session || !["AX_TEAM", "C_LEVEL"].includes((session.user as any).role)) redirect("/me")

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">AI Hub 관리 포털</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { href: "/admin/employees", icon: "👥", title: "직원 레벨 관리" },
            { href: "/admin/distribution", icon: "📦", title: "서비스 배분" },
            { href: "/admin/tokens", icon: "💰", title: "토큰·비용" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <h2 className="font-semibold text-sm">{item.title}</h2>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
