import nodemailer from 'nodemailer'

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.samsungam.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
}

export async function sendApprovalEmail(params: {
  to: string
  projectTitle: string
  totalScore: number
  isAutoApproved: boolean
}) {
  const subject = params.isAutoApproved
    ? `[AX AI 활용 승인] ${params.projectTitle}`
    : `[AX AI 활용 접수] ${params.projectTitle} — 검토 중`

  const text = params.isAutoApproved
    ? `안녕하세요,\n\n${params.projectTitle} AI 활용이 파일럿 단계로 승인되었습니다.\n종합 스코어: ${params.totalScore.toFixed(1)}점`
    : `안녕하세요,\n\n${params.projectTitle} AI 활용이 접수되었습니다.\n종합 스코어: ${params.totalScore.toFixed(1)}점\n\nAX팀장 검토 후 결과를 안내드리겠습니다.`

  try {
    const transport = getTransport()
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? 'AX Hub <ax-hub@samsungam.com>',
      to: params.to,
      subject,
      text,
    })
  } catch (e) {
    console.error('Email notification failed (non-fatal):', e)
  }
}
