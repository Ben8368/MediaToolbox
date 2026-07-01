export function DualLineChart({ dataUp, dataDown }: { dataUp: number[]; dataDown: number[] }) {
  const max = Math.max(...dataUp, ...dataDown, 1)
  const w = 280, h = 36
  const up = dataUp.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (dataUp.length - 1)) * w},${h - 4 - (p / max) * (h - 8)}`).join(' ')
  const down = dataDown.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (dataDown.length - 1)) * w},${h - 4 - (p / max) * (h - 8)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }}>
      <defs>
        <linearGradient id="dup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#54FFB7" stopOpacity=".25" />
          <stop offset="100%" stopColor="#54FFB7" stopOpacity=".02" />
        </linearGradient>
        <linearGradient id="ddn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4AA3FF" stopOpacity=".25" />
          <stop offset="100%" stopColor="#4AA3FF" stopOpacity=".02" />
        </linearGradient>
      </defs>
      <path d={`${down} L${w},${h} L0,${h} Z`} fill="url(#ddn)" />
      <path d={down} fill="none" stroke="#4AA3FF" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <path d={`${up} L${w},${h} L0,${h} Z`} fill="url(#dup)" />
      <path d={up} fill="none" stroke="#54FFB7" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
