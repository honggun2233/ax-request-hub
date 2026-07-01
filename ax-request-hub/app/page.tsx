import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">AX Request Hub</h1>
        <p className="text-gray-500 mb-10 text-lg">삼성자산운용 AX/PI팀 AI 과제 관리 포털</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/chat"
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold text-base hover:bg-blue-700 transition-colors"
          >
            AI 상담으로 과제 신청
          </Link>
          <Link
            href="/dashboard"
            className="border-2 border-gray-200 text-gray-700 px-8 py-4 rounded-2xl font-semibold text-base hover:bg-gray-50 transition-colors"
          >
            관리자 대시보드
          </Link>
        </div>
      </div>
    </main>
  )
}
