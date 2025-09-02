import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import AppV2 from './AppV2.tsx'
import AppV3 from './AppV3.tsx'
import AppV4 from './AppV4.tsx'
import './styles.css'

// Version selector based on URL parameter (default to v3)
const getAppVersion = (): 'v1' | 'v2' | 'v3' | 'v4' => {
  const urlParams = new URLSearchParams(window.location.search)
  const versionParam = urlParams.get('version')
  if (versionParam === 'v3') return 'v3'
  if (versionParam === 'v2') return 'v2'
  if (versionParam === 'v4') return 'v4'
  return 'v3'
}

const AppVersionSwitcher: React.FC = () => {
  const [currentVersion, setCurrentVersion] = React.useState<'v1' | 'v2' | 'v3' | 'v4'>(getAppVersion())

  React.useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('version', currentVersion)
    window.history.replaceState({}, '', url.toString())
  }, [currentVersion])

  const VersionBanner = () => (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white text-center py-2 text-sm">
      <div className="flex items-center justify-center gap-4">
        <span>
          StepFlow Builder {currentVersion.toUpperCase()}
          {currentVersion === 'v2' && <span className="ml-2 bg-blue-700 px-2 py-0.5 rounded text-xs">Multi-Workflow Tabs</span>}
          {currentVersion === 'v3' && <span className="ml-2 bg-green-700 px-2 py-0.5 rounded text-xs">Ultimate Edition</span>}
          {currentVersion === 'v4' && <span className="ml-2 bg-emerald-700 px-2 py-0.5 rounded text-xs">DSL Edition</span>}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentVersion('v1')}
            className={`px-3 py-1 rounded text-xs ${
              currentVersion === 'v1' ? 'bg-white text-blue-600' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            V1 (Original)
          </button>
          <button
            onClick={() => setCurrentVersion('v2')}
            className={`px-3 py-1 rounded text-xs ${
              currentVersion === 'v2' ? 'bg-white text-blue-600' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            V2 (Multi-Tab)
          </button>
          <button
            onClick={() => setCurrentVersion('v3')}
            className={`px-3 py-1 rounded text-xs ${
              currentVersion === 'v3' ? 'bg-white text-blue-600' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            V3 (Ultimate)
          </button>
          <button
            onClick={() => setCurrentVersion('v4')}
            className={`px-3 py-1 rounded text-xs ${
              currentVersion === 'v4' ? 'bg-white text-blue-600' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            V4 (DSL)
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      {/*<VersionBanner />*/}
      <div style={{ paddingTop: '8px', height: '100vh' }}>
        <AppV4 />
        {/*{currentVersion === 'v1' ? <App /> : */}
        {/* currentVersion === 'v2' ? <AppV2 /> :*/}
        {/* currentVersion === 'v4' ? <AppV4 /> :*/}
        {/* <AppV3 />}*/}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppVersionSwitcher />
  </React.StrictMode>,
)
