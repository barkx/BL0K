import { useState } from 'react'
import { Scene } from './scene/Scene'
import { Sidebar } from './ui/Sidebar'
import { Toolbar } from './ui/Toolbar'
import { MetricsPanel } from './ui/MetricsPanel'
import { SelectionPanel } from './ui/SelectionPanel'

export default function App() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={collapsed ? 'app collapsed' : 'app'}>
      <Toolbar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Sidebar />
      <div className="viewport">
        <Scene />
        <MetricsPanel />
        <SelectionPanel />
        <div className="hintbar">
          Drag to orbit · scroll to zoom · click an elevation to override it
        </div>
      </div>
    </div>
  )
}
