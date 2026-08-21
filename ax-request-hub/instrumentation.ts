// Next.js 서버 초기화 훅 — 앱 실행 전 안전장치 검사
export async function register() {
  // 안전장치3: 프로덕션에서 DEV_BYPASS_USER가 살아있으면 서버 시작 자체를 차단
  // authorize() 안에 두면 서버가 뜨고 나서 첫 로그인 시 에러가 나지만,
  // 여기 두면 배포 직후 바로 드러남 — CI/CD 파이프라인에서 조기 감지 가능
  if (process.env.NODE_ENV === "production" && process.env.DEV_BYPASS_USER) {
    throw new Error(
      "DEV_BYPASS_USER가 프로덕션 환경에 설정되어 있습니다. 즉시 제거하세요."
    )
  }
}
