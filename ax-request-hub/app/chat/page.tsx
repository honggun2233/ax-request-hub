import { ChatInterface } from '@/src/components/ChatInterface'

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto pt-8 pb-4 px-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">AX AI 활용 신청</h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          AI 도입 아이디어를 자유롭게 말씀해주세요. 에이전트가 신청서를 자동으로 작성합니다.
        </p>
        <ChatInterface />
      </div>
    </main>
  )
}
