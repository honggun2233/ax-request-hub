import type { Metadata } from 'next'
import GraphView from './GraphView'

export const metadata: Metadata = {
  title: '지식 그래프 | AX Hub',
  description: 'AX Hub 지식 그래프 — 에이전트, AI 활용, 데이터 자산, 직원 간 관계 시각화',
}

export default function GraphPage() {
  return <GraphView />
}
