import React from 'react'
import ReactDOM from 'react-dom/client'

// Import both versions
import StepFlowBuilderApp from './App'
import StepFlowBuilderAppV2 from './AppV2'
import './styles.css'

// Version selector - can be controlled via environment variable or URL parameter
const getAppVersion = (): 'v1' | 'v2' => {
  // Check URL parameter first
  const urlParams = new URLSearchParams(window.location.search)
  const versionParam = urlParams.get('version')
  
  if (versionParam === 'v2') return 'v2'
  if (versionParam === 'v1') return 'v1'
  
  // Check environment variable
  const envVersion = import.meta.env.VITE_APP_VERSION
  if (envVersion === 'v2') return 'v2'
  
  // Default to v1 (original stable version)
  return 'v1'
}

const AppVersionSwitcher: React.FC = () => {
  const [currentVersion, setCurrentVersion] = React.useState<'v1' | 'v2'>(getAppVersion())

  // Update URL when version changes
  React.useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('version', currentVersion)
    window.history.replaceState({}, '', url.toString())
  }, [currentVersion])

  const VersionBanner = () => (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white text-center py-2 text-sm">
      <div className="flex items-center justify-center gap-4">
        <span>
          Running StepFlow Builder {currentVersion.toUpperCase()} 
          {currentVersion === 'v2' && <span className="ml-2 bg-blue-700 px-2 py-0.5 rounded text-xs">Multi-Workflow Tabs</span>}
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
            V2 (Multi-Workflow)
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <VersionBanner />
      <div style={{ paddingTop: '48px' }}>
        {currentVersion === 'v1' ? <StepFlowBuilderApp /> : <StepFlowBuilderAppV2 />}
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppVersionSwitcher />
  </React.StrictMode>,
)