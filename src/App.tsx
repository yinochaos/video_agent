import React, { useState, useEffect } from 'react'
import { Download, Undo, Redo, History } from 'lucide-react'
import AssetPanel from './components/AssetPanel'
import Timeline from './components/Timeline'
import Preview from './components/Preview'
import ExportDialog from './components/ExportDialog'
import TextDesigner from './components/TextDesigner'
import ChatPanel from './components/ChatPanel'
import { useEditorStore } from './store/useEditorStore'
import { t } from './utils/i18n'
import './styles/app.css'

const App: React.FC = () => {
  const { language, undo, redo, undoStack, redoStack } = useEditorStore()
  const [showExportDialog, setShowExportDialog] = useState(false)

  // Listen for menu export events
  useEffect(() => {
    console.log('🚀 App component mounted')
    console.log('window.electronAPI available:', !!window.electronAPI)
    
    if (window.electronAPI) {
      console.log('✅ ElectronAPI found, setting up menu listeners')
      window.electronAPI.onMenuExportVideo(() => {
        console.log('📤 Menu export video triggered')
        setShowExportDialog(true)
      })
    } else {
      console.warn('⚠️ ElectronAPI not available - running in web mode?')
    }
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z (or Cmd+Z on Mac) for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        console.log('🔄 执行撤销操作')
        undo()
      }
      
      // Ctrl+Y or Ctrl+Shift+Z for redo
      if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault()
        console.log('🔄 执行重做操作')
        redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [undo, redo])

  const handleExportClick = () => {
    console.log('🎬 Export button clicked')
    setShowExportDialog(true)
  }

  return (
    <div className="app">
      {/* Top toolbar */}
      <div className="app-toolbar">
        <div className="toolbar-left">
          <h1>AI agent for video editing</h1>
        </div>
        
        {/* Undo/Redo controls */}
        <div className="toolbar-center">
          <div className="undo-redo-controls">
            <button
              className={`btn btn-icon ${undoStack.length === 0 ? 'disabled' : ''}`}
              onClick={undo}
              disabled={undoStack.length === 0}
              title={`撤销 (Ctrl+Z)${undoStack.length > 0 ? ` - ${undoStack[undoStack.length - 1]?.description}` : ''}`}
            >
              <Undo size={16} />
            </button>
            
            <button
              className={`btn btn-icon ${redoStack.length === 0 ? 'disabled' : ''}`}
              onClick={redo}
              disabled={redoStack.length === 0}
              title={`重做 (Ctrl+Y)${redoStack.length > 0 ? ` - ${redoStack[redoStack.length - 1]?.description}` : ''}`}
            >
              <Redo size={16} />
            </button>
            
            {/* Undo stack status */}
            <div className="undo-status">
              <History size={14} />
              <span className="undo-count">
                {undoStack.length > 0 ? `${undoStack.length}步` : '无历史'}
              </span>
            </div>
          </div>
          
          {/* Recent action display */}
          {undoStack.length > 0 && (
            <div className="recent-action">
              <span className="action-label">最近:</span>
              <span className="action-description">{undoStack[undoStack.length - 1]?.description}</span>
            </div>
          )}
          
          {/* Keyboard shortcuts hint */}
          <div className="shortcuts-hint">
            <kbd>Ctrl+Z</kbd> 撤销 | <kbd>Ctrl+Y</kbd> 重做
          </div>
        </div>
        
        <div className="toolbar-right">
          <button
            className="btn btn-primary"
            onClick={handleExportClick}
            title={t('exportVideo', language)}
          >
            <Download size={16} />
            {t('export', language)}
          </button>
        </div>
      </div>

      <div className="app-layout">
        {/* Left sidebar - Asset Panel */}
        <div className="sidebar-left">
          <AssetPanel />
        </div>

        {/* Main content area */}
        <div className="main-content">
          {/* Top section - Preview */}
          <div className="preview-section">
            <Preview />
          </div>

          {/* Bottom section - Timeline */}
          <div className="timeline-section">
            <Timeline />
          </div>
        </div>

        {/* Right sidebar - Chat Panel */}
        <div className="sidebar-right">
          <ChatPanel />
        </div>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
      
      {/* Text Designer */}
      <TextDesigner />
    </div>
  )
}

export default App 