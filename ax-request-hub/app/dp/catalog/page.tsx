import { redirect } from 'next/navigation'

// 데이터 자산은 데이터플랫폼 자체 시스템(Snowflake 등)에서 관리됩니다.
// AX Hub는 API를 통해 목록을 읽어와 직원에게 보여주기만 합니다.
export default function DpCatalogRedirect() {
  redirect('/dp/requests')
}
