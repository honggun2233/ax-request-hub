import type { Metadata } from 'next'
import GraphView from './GraphView'

export const metadata: Metadata = {
  title: 'AI 영향도 분석 | AX Hub',
  description: '에이전트 폐기·변경 시 연결된 AI 활용 과제와 데이터 자산에 미치는 영향 범위 시각화',
}

export default function GraphPage() {
  return <GraphView />
}
