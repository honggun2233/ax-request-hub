/**
 * CRON_SECRET 기반 배치 인증.
 * 스케줄러(cron)는 세션 쿠키를 보낼 수 없으므로
 * Authorization: Bearer <CRON_SECRET> 헤더로 인증한다.
 *
 * .env에 CRON_SECRET이 없거나 헤더가 불일치하면 false 반환.
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("Authorization");
  return header === `Bearer ${secret}`;
}
