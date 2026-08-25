"use client";
import { useState } from "react";
import { Bot } from "lucide-react";

type ProviderKey = "anthropic" | "openai" | "gemini" | "onprem";

const PROVIDERS: { key: ProviderKey; label: string; description: string }[] = [
  { key: "anthropic", label: "Claude (Anthropic)", description: "Claude 3.5 Sonnet" },
  { key: "openai",    label: "GPT (OpenAI)",       description: "GPT-4o" },
  { key: "gemini",    label: "Gemini (Google)",    description: "Gemini 1.5 Pro" },
  { key: "onprem",    label: "온프레미스 AI",        description: "내부 배포 모델" },
];

type Message = { role: "user" | "assistant"; content: string };

type QuotaInfo = { used: number; limit: number; remaining: number } | null;

export default function MeAiPage() {
  const [provider, setProvider] = useState<ProviderKey>("anthropic");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/ai/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `오류가 발생했습니다 (${res.status})`);
        setMessages(messages); // rollback
        return;
      }

      setMessages([...newMessages, { role: "assistant", content: data.content }]);
      if (data.quota) setQuota(data.quota);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const pct = quota && quota.limit > 0 ? Math.round((quota.used / quota.limit) * 100) : null;

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#FF6600]" />
            AI 직접 활용
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            레벨별 쿼터 범위 내에서 AI 모델에 직접 질문할 수 있습니다
          </p>
        </div>

        {/* 쿼터 표시 */}
        {quota && (
          <div className="text-right">
            <p className="text-xs text-[var(--muted)]">이번 달 사용량</p>
            <p className={`text-sm font-semibold ${pct && pct >= 80 ? "text-orange-500" : "text-[#FF6600]"}`}>
              {quota.used.toLocaleString()} / {quota.limit > 0 ? quota.limit.toLocaleString() : "∞"} 토큰
            </p>
            {pct !== null && (
              <div className="mt-0.5 h-1.5 w-32 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct >= 80 ? "bg-orange-400" : "bg-[#FF6600]"}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 제공자 선택 */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {PROVIDERS.map(p => (
          <button
            key={p.key}
            onClick={() => { setProvider(p.key); setMessages([]); setError(null); setQuota(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              provider === p.key
                ? "bg-[#FF6600] text-white border-[#FF6600]"
                : "bg-white text-[var(--muted)] border-[#1E1E1E] hover:bg-[#000000]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 대화창 */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-[#1E1E1E] p-4 space-y-4 mb-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-[var(--muted)]">
            <Bot className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {PROVIDERS.find(p => p.key === provider)?.label} 를 사용 중입니다
            </p>
            <p className="text-xs mt-1 opacity-70">
              {PROVIDERS.find(p => p.key === provider)?.description}
            </p>
            <p className="text-xs mt-3 opacity-50">
              질문을 입력하면 대화를 시작합니다. 레벨별 월 쿼터가 적용됩니다.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[#FF6600] text-white rounded-br-sm"
                  : "bg-[#000000] text-[#E0E0E0] rounded-bl-sm border border-[#1E1E1E]"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#000000] border border-[#1E1E1E] rounded-2xl rounded-bl-sm px-4 py-2.5">
              <span className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 입력창 */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          rows={1}
          placeholder="질문을 입력하세요… (Enter: 전송, Shift+Enter: 줄바꿈)"
          className="flex-1 border border-[#1E1E1E] rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-[#FF6600] disabled:opacity-50"
          style={{ minHeight: "44px", maxHeight: "120px" }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-[#FF6600] text-white rounded-xl text-sm font-medium hover:bg-[#0E0E0E] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          전송
        </button>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError(null); }}
            className="px-3 py-2.5 border border-[#1E1E1E] text-[var(--muted)] rounded-xl text-sm hover:bg-[#000000]"
          >
            초기화
          </button>
        )}
      </div>
    </div>
  );
}
