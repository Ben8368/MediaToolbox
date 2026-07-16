import { Component, type ErrorInfo, type ReactNode } from 'react'

type AppLoadBoundaryProps = {
  resetKey: string
  children: ReactNode
}

type AppLoadBoundaryState = {
  failed: boolean
}

/** 为按需加载的工作台提供可读失败态，避免单个 chunk 异常拖垮整个桌面。 */
export class AppLoadBoundary extends Component<AppLoadBoundaryProps, AppLoadBoundaryState> {
  state: AppLoadBoundaryState = { failed: false }

  static getDerivedStateFromError(): AppLoadBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('应用加载失败', error, info.componentStack)
  }

  componentDidUpdate(previous: AppLoadBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="mt-app-loading mt-app-load-error" role="alert">
          <span>应用资源加载失败。</span>
          <button type="button" onClick={() => window.location.reload()}>重新加载桌面</button>
        </div>
      )
    }
    return this.props.children
  }
}
