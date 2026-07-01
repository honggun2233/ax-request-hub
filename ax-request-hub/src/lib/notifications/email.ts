export async function sendApprovalEmail(params: {
  to: string
  projectTitle: string
  totalScore: number
  isAutoApproved: boolean
}) {
  const subject = params.isAutoApproved
    ? `[AX 과제 승인] ${params.projectTitle}`
    : `[AX 과제 접수] ${params.projectTitle} — 검토 중`
  const body = params.isAutoApproved
    ? `안녕하세요,\n\n${params.projectTitle} 과제가 파일럿 단계로 승인되었습니다.\n종합 스코어: ${params.totalScore.toFixed(1)}점`
    : `안녕하세요,\n\n${params.projectTitle} 과제가 접수되었습니다.\n종합 스코어: ${params.totalScore.toFixed(1)}점\n\nAX팀장 검토 후 결과를 안내드리겠습니다.`
  try {
    const { execSync } = await import('child_process')
    execSync(
      `python "C:\\Users\\Samsung\\Jarvis\\skills\\gmail-sender\\scripts\\gmail_sender.py" --to "${params.to}" --subject "${subject}" --body "${body.replace(/\n/g, '\\n')}"`,
      { env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 10000 }
    )
  } catch (e) {
    console.error('Email notification failed (non-fatal):', e)
  }
}
