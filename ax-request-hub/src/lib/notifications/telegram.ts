export async function sendTelegramApprovalRequest(params: {
  projectId: string
  title: string
  department: string
  totalScore: number
  rationale: string
  approvalUrl: string
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return
  const text =
    `🔔 *AX 과제 검토 요청*\n\n📋 *${params.title}*\n🏢 ${params.department}\n` +
    `📊 종합 스코어: *${params.totalScore.toFixed(1)}점*\n\n💡 ${params.rationale}\n\n승인/거절: ${params.approvalUrl}`
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

export async function sendTelegramNotification(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}
