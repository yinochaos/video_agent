import React, { useState, useCallback, useEffect } from 'react'
import { X, Download, Settings } from 'lucide-react'
import { useEditorStore } from '../store/useEditorStore'
import { t } from '../utils/i18n'
import { exportVideoNative } from '../utils/ffmpeg'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
}

const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose }) => {
  const {
    language,
    tracks,
    mediaFiles,
    textLogos,
    duration,
    isExporting,
    exportProgress,
    startExport,
    updateExportProgress,
    finishExport
  } = useEditorStore()

  const [exportSettings, setExportSettings] = useState({
    resolution: '1920x1080',
    format: 'mp4',
    frameRate: 30,
    bitrate: 5000,
    outputPath: ''
  })

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [ffmpegStatus, setFFmpegStatus] = useState<'idle' | 'initializing' | 'ready' | 'error'>('idle')
  const [ffmpegError, setFFmpegError] = useState<string>('')
  const [nativeFFmpegAvailable, setNativeFFmpegAvailable] = useState<boolean | null>(null)

  // Check native FFmpeg availability on mount
  useEffect(() => {
    const checkNativeFFmpeg = async () => {
      if (window.electronAPI?.checkFFmpeg) {
        try {
          const result = await window.electronAPI.checkFFmpeg()
          setNativeFFmpegAvailable(result.available)
          console.log('🔍 本地FFmpeg检查结果:', result)
        } catch (error) {
          setNativeFFmpegAvailable(false)
          console.error('❌ 检查本地FFmpeg失败:', error)
        }
      } else {
        setNativeFFmpegAvailable(false)
      }
    }
    
    checkNativeFFmpeg()
  }, [])

  // Check electronAPI availability
  useEffect(() => {
    console.log('🔍 检查ElectronAPI可用性...')
    console.log('window.electronAPI:', window.electronAPI)
    console.log('showSaveDialog available:', window.electronAPI?.showSaveDialog)
  }, [])

  const resolutionOptions = [
    { value: '1920x1080', label: '1080p (1920×1080)' },
    { value: '1280x720', label: '720p (1280×720)' },
    { value: '854x480', label: '480p (854×480)' },
    { value: 'original', label: 'Original Resolution' }
  ]

  const frameRateOptions = [
    { value: 24, label: '24 fps' },
    { value: 25, label: '25 fps' },
    { value: 30, label: '30 fps' },
    { value: 60, label: '60 fps' }
  ]

  const bitrateOptions = [
    { value: 1000, label: '1 Mbps' },
    { value: 2500, label: '2.5 Mbps' },
    { value: 5000, label: '5 Mbps' },
    { value: 8000, label: '8 Mbps' },
    { value: 12000, label: '12 Mbps' }
  ]

  const handleExport = useCallback(async () => {
    console.log('🎬 导出开始 - handleExport called')
    
    try {
      // Check if electronAPI is available
      if (!window.electronAPI) {
        console.error('❌ ElectronAPI not available')
        alert('Error: Electron API not available. Please restart the application.')
        return
      }

      console.log('📁 显示保存对话框...')
      // Show save dialog
      const result = await window.electronAPI.showSaveDialog()
      console.log('📁 保存对话框结果:', result)
      
      if (result.canceled || !result.filePath) {
        console.log('❌ 用户取消了保存对话框')
        return
      }

      console.log('📝 设置导出路径:', result.filePath)
      setExportSettings(prev => ({ ...prev, outputPath: result.filePath || 'export.mp4' }))
      
      console.log('▶️ 开始导出状态')
      startExport()

      // Collect all clips from tracks
      const allClips = tracks.flatMap(track => track.clips)
      console.log('📹 收集到的片段:', allClips.length)
      console.log('🎵 媒体文件数量:', mediaFiles.length)
      console.log('📝 文字logo数量:', textLogos.length)
      
                         // 只使用本地FFmpeg
      console.log('🔧 开始本地FFmpeg导出流程...')
      setFFmpegStatus('initializing')
      setFFmpegError('')
      
      console.log('🎬 开始视频导出...')
      console.log('🔍 检查本地FFmpeg可用性...')
      
      const ffmpegCheck = await (window.electronAPI as any).checkFFmpeg()
      if (!ffmpegCheck.available) {
        throw new Error(`本地FFmpeg不可用: ${ffmpegCheck.error}. 请确保系统已安装FFmpeg。`)
      }
      
      console.log('✅ 本地FFmpeg可用，开始导出...')
      await exportVideoNative({
        clips: allClips,
        mediaFiles,
        textLogos,
        duration,
        resolution: exportSettings.resolution,
        frameRate: exportSettings.frameRate,
        bitrate: exportSettings.bitrate,
        outputPath: result.filePath,
        onProgress: (progress: number) => {
          console.log(`📊 本地FFmpeg进度: ${progress}%`)
          updateExportProgress(progress)
        }
      })
      console.log('✅ 本地FFmpeg导出完成! 文件已保存到:', result.filePath)

      console.log('✅ 导出完成')
      setFFmpegStatus('ready')
      finishExport()
      onClose()
    } catch (error) {
      console.error('❌ 导出失败:', error)
      setFFmpegStatus('error')
      setFFmpegError(error instanceof Error ? error.message : 'Unknown error')
      
      // Show user-friendly error message
      let userMessage = '导出失败: '
      if (error instanceof Error) {
        if (error.message.includes('FFmpeg初始化失败')) {
          userMessage += '无法连接到FFmpeg服务器。请检查网络连接或稍后重试。'
        } else if (error.message.includes('Failed to fetch')) {
          userMessage += '网络连接问题。请检查您的网络设置。'
        } else {
          userMessage += error.message
        }
      } else {
        userMessage += '未知错误'
      }
      
      alert(userMessage)
      finishExport()
    }
  }, [exportSettings, tracks, mediaFiles, textLogos, duration, startExport, updateExportProgress, finishExport, onClose])

  const handleCancel = useCallback(() => {
    // Cancel export if in progress
    if (isExporting) {
      finishExport()
    }
    onClose()
  }, [isExporting, finishExport, onClose])

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="export-dialog-overlay">
      <div className="export-dialog">
        <div className="export-dialog-header">
          <h2>{t('exportSettings', language)}</h2>
          <button
            className="close-btn"
            onClick={handleCancel}
            disabled={isExporting}
          >
            <X size={20} />
          </button>
        </div>

        <div className="export-dialog-content">
          {isExporting ? (
            <div className="export-progress">
              <h3>{t('exporting', language)}</h3>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p>{Math.round(exportProgress)}% complete</p>
              <p>Duration: {formatDuration(duration)}</p>
              <div className="export-status">
                {exportProgress < 20 && <p>正在加载媒体文件...</p>}
                {exportProgress >= 20 && exportProgress < 50 && <p>正在处理视频片段...</p>}
                {exportProgress >= 50 && exportProgress < 80 && <p>正在合并视频轨道...</p>}
                {exportProgress >= 80 && exportProgress < 95 && <p>正在添加文字logo和音频...</p>}
                {exportProgress >= 95 && <p>正在生成最终文件...</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="export-settings">
                <div className="setting-group">
                  <label>{t('resolution', language)}</label>
                  <select
                    value={exportSettings.resolution}
                    onChange={(e) => setExportSettings(prev => ({ 
                      ...prev, 
                      resolution: e.target.value 
                    }))}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  >
                    <option value="original">保持原始分辨率</option>
                  </select>
                  <small style={{ color: '#999', fontSize: '10px', marginTop: '4px' }}>
                    文字logo将直接覆盖在原始视频上，不改变视频分辨率
                  </small>
                </div>

                <div className="setting-group">
                  <label>{t('format', language)}</label>
                  <select
                    value={exportSettings.format}
                    onChange={(e) => setExportSettings(prev => ({ 
                      ...prev, 
                      format: e.target.value 
                    }))}
                  >
                    <option value="mp4">MP4 (H.264 + AAC)</option>
                  </select>
                </div>

                <button
                  className="advanced-toggle"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <Settings size={16} />
                  Advanced Settings
                </button>

                {showAdvanced && (
                  <div className="advanced-settings">
                    <div className="setting-group">
                      <label>{t('frameRate', language)}</label>
                      <select
                        value={exportSettings.frameRate}
                        onChange={(e) => setExportSettings(prev => ({ 
                          ...prev, 
                          frameRate: parseInt(e.target.value) 
                        }))}
                      >
                        {frameRateOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="setting-group">
                      <label>{t('bitrate', language)}</label>
                      <select
                        value={exportSettings.bitrate}
                        onChange={(e) => setExportSettings(prev => ({ 
                          ...prev, 
                          bitrate: parseInt(e.target.value) 
                        }))}
                      >
                        {bitrateOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Debug Info */}
              <div className="export-debug" style={{ 
                background: '#1a1a1a', 
                padding: '12px', 
                borderRadius: '4px', 
                marginBottom: '16px',
                border: '1px solid #333'
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#999' }}>系统状态</h4>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  <div>轨道数量: {tracks.length}</div>
                  <div>片段总数: {tracks.flatMap(t => t.clips).length}</div>
                  <div>媒体文件数: {mediaFiles.length}</div>
                  <div>文字logo数: {textLogos.length}</div>
                  <div>时长: {formatDuration(duration)}</div>
                  <div>ElectronAPI: {window.electronAPI ? '✅' : '❌'}</div>
                  <div>本地FFmpeg: {
                    nativeFFmpegAvailable === null ? '🔄 检查中...' :
                    nativeFFmpegAvailable ? '✅ 可用' : '❌ 不可用'
                  }</div>
                  <div>导出状态: {
                    ffmpegStatus === 'idle' ? '⏸️ 空闲' :
                    ffmpegStatus === 'initializing' ? '🔄 处理中...' :
                    ffmpegStatus === 'ready' ? '✅ 完成' :
                    ffmpegStatus === 'error' ? '❌ 错误' : '❓ 未知'
                  }</div>
                  {ffmpegError && (
                    <div style={{ color: '#ff6b6b', marginTop: '4px', fontSize: '10px' }}>
                      错误: {ffmpegError}
                    </div>
                  )}
                </div>
              </div>

              <div className="export-summary">
                <h4>Export Summary</h4>
                <div className="summary-item">
                  <span>Duration:</span>
                  <span>{formatDuration(duration)}</span>
                </div>
                <div className="summary-item">
                  <span>Resolution:</span>
                  <span>保持原始分辨率</span>
                </div>
                <div className="summary-item">
                  <span>Frame Rate:</span>
                  <span>{exportSettings.frameRate} fps</span>
                </div>
                <div className="summary-item">
                  <span>Bitrate:</span>
                  <span>{exportSettings.bitrate / 1000} Mbps</span>
                </div>
                <div style={{ marginTop: '12px', padding: '8px', background: '#2a2a2a', borderRadius: '4px', fontSize: '11px', color: '#999' }}>
                  <div>📋 导出方案:</div>
                  <div>• {nativeFFmpegAvailable ? '✅' : '❌'} 本地FFmpeg (推荐, MP4格式)</div>
                  <div>• 🌐 网络FFmpeg (需要网络, MP4格式)</div>
                  <div>• 🔄 网络FFmpeg (备选方案, MP4格式)</div>
                  {nativeFFmpegAvailable === false && (
                    <div style={{ marginTop: '8px', padding: '6px', background: '#3a2a2a', borderRadius: '3px', fontSize: '10px' }}>
                      <div style={{ color: '#ffaa00' }}>⚠️ 建议安装本地FFmpeg以获得最佳性能:</div>
                      <div style={{ marginTop: '4px' }}>
                        <div>• macOS: <code>brew install ffmpeg</code></div>
                        <div>• Windows: 从 <a href="https://ffmpeg.org/download.html" target="_blank" style={{ color: '#4a9eff' }}>ffmpeg.org</a> 下载</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="export-dialog-footer">
          {isExporting ? (
            <button
              className="btn btn-danger"
              onClick={handleCancel}
            >
              {t('cancel', language)}
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={onClose}
              >
                {t('cancel', language)}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExport}
                disabled={tracks.length === 0}
                title={tracks.length === 0 ? "请先添加视频素材到时间线" : "开始导出视频"}
              >
                <Download size={16} />
                {t('export', language)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExportDialog 