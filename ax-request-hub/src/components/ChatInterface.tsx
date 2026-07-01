'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from './ChatMessage'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function initChat() {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setMessages([{ role: 'assistant', content: data.message }])
      setSessionId(data.sessionId)
    } catch (e) {
      setMessages([{ role: 'assistant', content: '연결 오류가 발생했습니다. 새로고침해주세요.' }])
    } finally {
      setInitializing(false)
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userContent = input
    setMessages((prev) => [...prev, { role: 'user', content: userContent }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userMessage: userContent }),
      })
      const data = await res.json()

      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])
      if (data.sessionId) setSessionId(data.sessionId)

      if (data.isComplete && data.extracted) {
        setTimeout(() => {
          if (data.projectId) {
            router.push(`/submit?projectId=${data.projectId}`)
          }
        }, 1500)
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' }])
    } finally {
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        에이전트 연결 중...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[70vh] max-w-2xl mx-auto border rounded-2xl overflow-hidden shadow-sm">
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {messages.map((m, i) => (
          <ChatMessage key={i} role={m.role} content={m.content} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-100 rounded-2xl px-4 py-2 text-gray-500 text-sm">
              입력 중...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t bg-gray-50 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="AI 도입 아이디어를 자유롭게 말씀해주세요..."
          className="flex-1 border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white rounded-xl px-5 py-2 text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          전송
        </button>
      </div>
    </div>
  )
}
