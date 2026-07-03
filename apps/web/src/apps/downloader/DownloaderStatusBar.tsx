import { useCallback, useEffect, useState } from 'react'

import { fetchSystemRuntimeMetrics } from '@/api'
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling'

const ZERO_SPEED = { text: '0 B/s' }

type DownloaderStatusBarProps = {
  detailOpen: boolean
  onToggleDetail: () => void
}

export function DownloaderStatusBar({ detailOpen, onToggleDetail }: DownloaderStatusBarProps) {
  const [network, setNetwork] = useState({
    upload: ZERO_SPEED,
    download: ZERO_SPEED,
  })

  const refreshNetwork = useCallback(async () => {
    try {
      const metrics = await fetchSystemRuntimeMetrics()
      if (metrics.network) {
        setNetwork({
          upload: normalizeNetworkSpeed(metrics.network.upload),
          download: normalizeNetworkSpeed(metrics.network.download),
        })
      }
    } catch {
      // 保留上次成功显示的网络速率
    }
  }, [])

  useVisibilityPolling(refreshNetwork, 1000)

  return (
    <footer className="dl-status">
      <span className="dl-speed">
        ↓ {network.download?.text || '0 B/s'} <span>|</span> ↑ {network.upload?.text || '0 B/s'}
      </span>
      <button type="button" className="dl-task-detail" onClick={onToggleDetail}>
        {detailOpen ? '收起详情' : '任务详情'}
      </button>
    </footer>
  )
}

function normalizeNetworkSpeed(value?: { text?: string }) {
  return { text: value?.text || ZERO_SPEED.text }
}
