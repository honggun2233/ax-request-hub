interface ScoreCardProps {
  impactScore: number
  roiScore: number
  confidentialityScore: number
  difficultyScore: number
  readinessScore: number
  strategyScore: number
  totalScore: number
  evaluationRationale: string
}

const DIMENSIONS: Array<{ key: keyof ScoreCardProps; label: string; max: number }> = [
  { key: 'impactScore', label: '임팩트', max: 25 },
  { key: 'roiScore', label: 'ROI', max: 25 },
  { key: 'confidentialityScore', label: '기밀등급', max: 15 },
  { key: 'difficultyScore', label: '난이도(역산)', max: 15 },
  { key: 'readinessScore', label: '현업 준비도', max: 10 },
  { key: 'strategyScore', label: '전략 정합성', max: 10 },
]

export function ScoreCard(props: ScoreCardProps) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">종합 스코어</span>
        <span className="text-2xl font-bold text-blue-600">{props.totalScore.toFixed(1)}</span>
      </div>
      <div className="space-y-2">
        {DIMENSIONS.map(({ key, label, max }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${Math.min(100, ((props[key] as number) / max) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-12 text-right">
              {(props[key] as number).toFixed(0)}/{max}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3 leading-relaxed">{props.evaluationRationale}</p>
    </div>
  )
}
