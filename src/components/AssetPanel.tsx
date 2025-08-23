import React, { useState, useCallback, useRef } from 'react'
import { Search, Plus, Trash2, FolderOpen, Subtitles } from 'lucide-react'
import SubtitleExtractorDialog from './SubtitleExtractorDialog'
import { useEditorStore, MediaFile } from '../store/useEditorStore'
import { t } from '../utils/i18n'

declare global {
  interface Window {
    electronAPI: {
      showOpenDialog: () => Promise<{canceled: boolean, filePaths: string[]}>
      showSaveDialog: () => Promise<{canceled: boolean, filePath?: string}>
      onMenuImportMedia: (callback: () => void) => void
      onMenuExportVideo: (callback: () => void) => void
    }
  }
}

const AssetPanel: React.FC = () => {
  const {
    mediaFiles,
    selectedMediaFiles,
    language,
    addMediaFiles,
    removeMediaFile,
    selectMediaFile,
    clearSelection
  } = useEditorStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [showSubtitleExtractor, setShowSubtitleExtractor] = useState(false)
  const [selectedFileForSubtitles, setSelectedFileForSubtitles] = useState<MediaFile | null>(null)
  const [batchMode, setBatchMode] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter files based on search term
  const filteredFiles = mediaFiles.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video':
        return '🎬'
      case 'audio':
        return '🎵'
      case 'image':
        return '🖼️'
      default:
        return '📄'
    }
  }

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const createMediaFileFromPath = async (filePath: string): Promise<MediaFile> => {
    const name = filePath.split('/').pop() || filePath.split('\\').pop() || filePath
    const extension = name.split('.').pop()?.toLowerCase() || ''
    
    let type: 'video' | 'audio' | 'image' | 'srt' = 'video'
    if (['mp3', 'wav', 'aac', 'ogg'].includes(extension)) {
      type = 'audio'
    } else if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      type = 'image'
    } else if (extension === 'srt') {
      type = 'srt'
    }

    // For Electron, we can use file:// protocol directly
    // But we need to ensure proper encoding
    const url = `file://${encodeURI(filePath.replace(/\\/g, '/'))}`

    // Try to get file metadata for videos
    let duration: number | undefined
    let size = 0

    if (type === 'video' || type === 'audio') {
      try {
        // Create a temporary media element to get duration
        const tempElement = type === 'video' 
          ? document.createElement('video') 
          : document.createElement('audio')
        
        const metadataPromise = new Promise<{ duration: number; size: number }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Metadata loading timeout'))
          }, 5000)

          tempElement.onloadedmetadata = () => {
            clearTimeout(timeout)
            resolve({
              duration: tempElement.duration || 0,
              size: 0 // File size would need to be obtained from main process
            })
          }

          tempElement.onerror = () => {
            clearTimeout(timeout)
            reject(new Error('Failed to load media metadata'))
          }

          tempElement.src = url
          tempElement.load()
        })

        const metadata = await metadataPromise
        duration = metadata.duration
        size = metadata.size
      } catch (error) {
        console.warn('Failed to get media metadata:', error)
        duration = type === 'video' ? 10 : undefined // Default duration
      }
    }

    return {
      id: `file-${Date.now()}-${Math.random()}`,
      name,
      path: filePath,
      type,
      size,
      url,
      duration
    }
  }

  const handleImportFiles = useCallback(async () => {
    try {
      const result = await window.electronAPI.showOpenDialog()
      if (!result.canceled && result.filePaths.length > 0) {
        const mediaFiles = await Promise.all(
          result.filePaths.map(createMediaFileFromPath)
        )
        addMediaFiles(mediaFiles)
      }
    } catch (error) {
      console.error('Failed to import files:', error)
    }
  }, [addMediaFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const mediaFiles = await Promise.all(
      files.map(file => createMediaFileFromPath(file.path))
    )
    addMediaFiles(mediaFiles)
  }, [addMediaFiles])

  const handleFileClick = useCallback((fileId: string, e: React.MouseEvent) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey
    selectMediaFile(fileId, isCtrlOrCmd)
  }, [selectMediaFile])

  const handleFileDoubleClick = useCallback((file: MediaFile) => {
    // Add to timeline on double click
    console.log('Double clicked file:', file)
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, file: MediaFile) => {
    // Set drag data for timeline drop
    e.dataTransfer.setData('text/plain', file.id)
    e.dataTransfer.setData('application/json', JSON.stringify(file))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  const handleDeleteSelected = useCallback(() => {
    selectedMediaFiles.forEach(fileId => {
      removeMediaFile(fileId)
    })
    clearSelection()
  }, [selectedMediaFiles, removeMediaFile, clearSelection])
  
  // 处理单个文件视频理解
  const handleExtractSubtitles = useCallback((file: MediaFile) => {
    if (file.type !== 'video') {
      console.warn('只能为视频文件提取字幕')
      return
    }
    
    setBatchMode(false)
    setSelectedFileForSubtitles(file)
    setShowSubtitleExtractor(true)
  }, [])
  
  // 处理批量视频理解
  const handleBatchExtractSubtitles = useCallback(() => {
    // 获取所有视频文件
    const videoFiles = mediaFiles.filter(file => file.type === 'video')
    
    if (videoFiles.length === 0) {
      console.warn('没有可用的视频文件')
      return
    }
    
    setBatchMode(true)
    setSelectedFileForSubtitles(null)
    setShowSubtitleExtractor(true)
  }, [mediaFiles])

  // Listen for menu import events
  React.useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onMenuImportMedia(handleImportFiles)
    }
  }, [handleImportFiles])

  return (
    <div className="asset-panel">
      <div className="asset-panel-header">
        <h3>{t('assetPanel', language)}</h3>
        <div className="asset-panel-actions">
          <button
            className="btn btn-primary"
            onClick={handleImportFiles}
            title={t('importFiles', language)}
          >
            <Plus size={16} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleBatchExtractSubtitles}
            title="批量视频理解"
          >
            <Subtitles size={16} />
          </button>
          {selectedMediaFiles.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={handleDeleteSelected}
              title={t('deleteFile', language)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="search-box">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder={t('search', language)}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div
        className={`file-drop-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleImportFiles}
      >
        {filteredFiles.length === 0 && searchTerm === '' ? (
          <div className="drop-zone-content">
            <FolderOpen size={48} className="drop-zone-icon" />
            <p>{t('dragFilesHere', language)}</p>
          </div>
        ) : (
          <div className="file-list">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className={`file-item ${selectedMediaFiles.includes(file.id) ? 'selected' : ''}`}
                draggable={true}
                onClick={(e) => handleFileClick(file.id, e)}
                onDoubleClick={() => handleFileDoubleClick(file)}
                onDragStart={(e) => handleDragStart(e, file)}
              >
                <div className="file-thumbnail">
                  {file.thumbnail ? (
                    <img src={file.thumbnail} alt={file.name} />
                  ) : (
                    <div className="file-icon">{getFileIcon(file.type)}</div>
                  )}
                </div>
                <div className="file-info">
                  <div className="file-name" title={file.name}>
                    {file.name}
                  </div>
                  <div className="file-meta">
                    <span className="file-duration">{formatDuration(file.duration)}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    {file.type === 'video' && (
                      <button 
                        className="extract-subtitles-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtractSubtitles(file);
                        }}
                        title="视频理解"
                      >
                        <Subtitles size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 视频理解对话框 */}
      <SubtitleExtractorDialog
        isOpen={showSubtitleExtractor}
        onClose={() => setShowSubtitleExtractor(false)}
        mediaFile={selectedFileForSubtitles || undefined}
        isBatchMode={batchMode}
      />
    </div>
  )
}

export default AssetPanel