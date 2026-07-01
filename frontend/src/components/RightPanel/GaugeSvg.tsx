import { clampPercent } from './utils'

export function GaugeSvg({
  value,
  color,
  label,
  title,
  available = true,
}: {
  value: number
  color: string
  label: string
  title?: string
  available?: boolean
}) {
  const r = 24, cx = 28, cy = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (clampPercent(value) / 100) * circ
  const displayValue = available ? `${Math.round(clampPercent(value))}%` : '未支持'
  return (
    <div className="rp-gauge" title={title}>
      <svg viewBox="0 0 56 56" style={{ shapeRendering: 'geometricPrecision' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="4" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)', paintOrder: 'stroke' }} />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="rgba(255,255,255,.55)" fontSize="8.5" fontWeight="500">{label}</text>
        <text x={cx} y={cy + 7} textAnchor="middle" fill="rgba(255,255,255,.92)" fontSize="9" fontWeight="600">{displayValue}</text>
      </svg>
    </div>
  )
}
