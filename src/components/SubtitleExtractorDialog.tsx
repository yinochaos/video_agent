import React, { useState, useEffect, useCallback } from 'react'
import { useEditorStore, MediaFile } from '../store/useEditorStore'
import '../styles/subtitle-extractor-dialog.css'

interface SubtitleExtractorDialogProps {
  isOpen: boolean
  onClose: () => void
  mediaFile?: MediaFile
  isBatchMode?: boolean
}

interface LogEntry {
  timestamp: string
  message: string
  type: 'info' | 'error' | 'success'
}

const SubtitleExtractorDialog: React.FC<SubtitleExtractorDialogProps> = ({ 
  isOpen, 
  onClose,
  mediaFile,
  isBatchMode = false
}) => {
  const { mediaFiles } = useEditorStore()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [result, setResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [mp3Path, setMp3Path] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [step, setStep] = useState<'converting' | 'extracting' | 'saving' | 'completed'>('converting')
  
  // 批量处理相关状态
  const [batchFiles, setBatchFiles] = useState<MediaFile[]>([])
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0)
  const [batchProgress, setBatchProgress] = useState<number>(0)
  const [batchResults, setBatchResults] = useState<{file: MediaFile, success: boolean, error?: string}[]>([])
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false)
  
  // 添加日志
  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const now = new Date()
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`
    
    setLogs(prevLogs => [...prevLogs, { timestamp, message, type }])
    
    // 在控制台也输出日志
    switch (type) {
      case 'error':
        console.error(`[ASR Test] ${message}`)
        break
      case 'success':
        console.log(`[ASR Test] ✅ ${message}`)
        break
      default:
        console.log(`[ASR Test] ${message}`)
    }
  }, [])
  
  // 清除日志
  const clearLogs = useCallback(() => {
    setLogs([])
    addLog('日志已清除', 'info')
  }, [addLog])

  // 重置状态
  const resetState = useCallback(() => {
    setIsLoading(false)
    setProgress(0)
    setStep('converting')
    setResult('')
    setMp3Path('')
    setLogs([])
    setBatchProgress(0)
    setCurrentBatchIndex(0)
    setBatchResults([])
    setIsBatchProcessing(false)
  }, [])

  // 将MP4转换为MP3
  const convertToMp3 = useCallback(async () => {
    if (!mediaFile || mediaFile.type !== 'video') {
      addLog('无效的媒体文件或非视频文件', 'error')
      return false
    }

    try {
      setStep('converting')
      addLog(`开始将视频转换为MP3...`, 'info')
      
      // 构建输出MP3路径
      const outputPath = mediaFile.path.replace(/\.[^/.]+$/, '.mp3')
      setMp3Path(outputPath)
      
      // 使用Electron API调用ffmpeg
      if (window.electronAPI && window.electronAPI.convertToMp3) {
        addLog(`执行命令: ffmpeg -i "${mediaFile.path}" -vn -ar 16000 -ac 1 -b:a 32k -y "${outputPath}"`, 'info')
        
        const result = await window.electronAPI.convertToMp3({
          inputPath: mediaFile.path,
          outputPath,
          onProgress: (p: number) => {
            setProgress(Math.min(p * 0.5, 50)) // 转换占总进度的50%
          }
        })
        
        if (result.success) {
          addLog(`MP3转换成功: ${outputPath}`, 'success')
          return true
        } else {
          throw new Error(result.error || '转换失败')
        }
      } else {
        throw new Error('Electron API不可用')
      }
    } catch (error) {
      addLog(`MP3转换失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
      return false
    }
  }, [mediaFile, addLog])
  
  // 为批量处理准备的MP3转换函数
  const convertToMp3ForBatch = useCallback(async (file: MediaFile) => {
    if (file.type !== 'video') {
      addLog('无效的媒体文件或非视频文件', 'error')
      return { success: false }
    }

    try {
      setStep('converting')
      addLog(`开始将视频转换为MP3...`, 'info')
      
      // 构建输出MP3路径
      const outputPath = file.path.replace(/\.[^/.]+$/, '.mp3')
      setMp3Path(outputPath)
      
      // 使用Electron API调用ffmpeg
      if (window.electronAPI && window.electronAPI.convertToMp3) {
        addLog(`执行命令: ffmpeg -i "${file.path}" -vn -ar 16000 -ac 1 -b:a 32k -y "${outputPath}"`, 'info')
        
        const result = await window.electronAPI.convertToMp3({
          inputPath: file.path,
          outputPath,
          onProgress: (p: number) => {
            setProgress(Math.min(p * 0.5, 50)) // 转换占总进度的50%
          }
        })
        
        if (result.success) {
          addLog(`MP3转换成功: ${outputPath}`, 'success')
          return { success: true, outputPath }
        } else {
          throw new Error(result.error || '转换失败')
        }
      } else {
        throw new Error('Electron API不可用')
      }
    } catch (error) {
      addLog(`MP3转换失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
      return { success: false }
    }
  }, [addLog])

  // 发送ASR请求提取字幕
  const extractSubtitlesFromMp3 = useCallback(async (customMp3Path?: string) => {
    const pathToUse = customMp3Path || mp3Path
    
    if (!pathToUse) {
      addLog('没有可用的MP3文件', 'error')
      return false
    }
    
    try {
      setStep('extracting')
      addLog('开始提取字幕...', 'info')
      
      // 读取MP3文件
      const mp3File = await window.electronAPI.readFileAsBuffer(pathToUse)
      if (!mp3File || !mp3File.buffer) {
        throw new Error('无法读取MP3文件')
      }
      
      // 创建FormData对象
      const formData = new FormData()
      formData.append('audio_file', new File([mp3File.buffer], pathToUse.split('/').pop() || 'audio.mp3', { type: 'audio/mpeg' }))
      formData.append('language', 'zh')
      
      addLog(`发送请求到ASR服务: /api/asr/recognize`, 'info')
      
      const startTime = Date.now()
      const response = await fetch('/api/asr/recognize', {
        method: 'POST',
        body: formData,
      })
      
      const endTime = Date.now()
      const duration = ((endTime - startTime) / 1000).toFixed(2)
      
      if (!response.ok) {
        throw new Error(`服务器返回错误: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      addLog(`请求成功完成，耗时 ${duration} 秒`, 'success')
      setProgress(90) // 提取字幕占总进度的40%，现在到90%
      
      // 检查是否有字幕内容
      if (data.srt_content) {
        setResult(data.srt_content)
        addLog(`成功提取字幕，长度: ${data.srt_content.length} 字符`, 'success')
        return data.srt_content
      } else if (data.text) {
        // 如果没有SRT但有文本，也显示出来
        setResult(data.text)
        addLog(`提取到文本，但没有SRT格式字幕`, 'info')
        return data.text
      } else {
        throw new Error('响应中没有找到字幕内容')
      }
    } catch (error) {
      addLog(`字幕提取失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
      return false
    }
  }, [mp3Path, addLog])

  // 保存SRT文件
  const saveSrtFile = useCallback(async (content: string, targetFile?: MediaFile) => {
    const fileToUse = targetFile || mediaFile
    
    if (!content || !fileToUse) {
      addLog('没有可用的字幕内容或媒体文件', 'error')
      return false
    }
    
    try {
      setStep('saving')
      const srtPath = fileToUse.path.replace(/\.[^/.]+$/, '.srt')
      
      addLog(`正在保存SRT文件: ${srtPath}`, 'info')
      
      if (window.electronAPI && window.electronAPI.writeFile) {
        const result = await window.electronAPI.writeFile({
          path: srtPath,
          content
        })
        
        if (result.success) {
          addLog(`SRT文件保存成功: ${srtPath}`, 'success')
          setProgress(100)
          setStep('completed')
          return true
        } else {
          throw new Error(result.error || '保存失败')
        }
      } else {
        throw new Error('Electron API不可用')
      }
    } catch (error) {
      addLog(`SRT文件保存失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
      return false
    }
  }, [mediaFile, addLog])

  // 完整的字幕提取流程
  const extractSubtitles = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // 步骤1: 转换为MP3
      const mp3Success = await convertToMp3()
      if (!mp3Success) {
        throw new Error('MP3转换失败')
      }
      
      // 步骤2: 提取字幕
      const subtitles = await extractSubtitlesFromMp3()
      if (!subtitles) {
        throw new Error('字幕提取失败')
      }
      
      // 步骤3: 保存SRT文件
      const saveSuccess = await saveSrtFile(subtitles as string)
      if (!saveSuccess) {
        throw new Error('SRT文件保存失败')
      }
      
      addLog('字幕提取完成！', 'success')
    } catch (error) {
      addLog(`字幕提取过程中出错: ${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [convertToMp3, extractSubtitlesFromMp3, saveSrtFile, addLog])
  
  // 批量处理函数
  const startBatchProcess = useCallback(async () => {
    // 获取所有视频文件
    const videoFiles = mediaFiles.filter(file => file.type === 'video')
    
    if (videoFiles.length === 0) {
      addLog('没有可用的视频文件', 'error')
      return
    }
    
    setIsBatchProcessing(true)
    setIsLoading(true)
    addLog(`开始批量处理 ${videoFiles.length} 个文件`, 'info')
    
    const results = []
    
    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i]
      setCurrentBatchIndex(i)
      setBatchProgress(Math.round((i / videoFiles.length) * 100))
      
      addLog(`[${i + 1}/${videoFiles.length}] 处理文件: ${file.name}`, 'info')
      
      try {
        // 重置单个文件的处理状态
        setProgress(0)
        setStep('converting')
        setResult('')
        setMp3Path('')
        
        // 转换为MP3
        addLog(`[${i + 1}/${videoFiles.length}] 开始转换为MP3...`, 'info')
        const mp3Result = await convertToMp3ForBatch(file)
        if (!mp3Result || !mp3Result.outputPath) {
          throw new Error('MP3转换失败')
        }
        
        // 提取字幕
        addLog(`[${i + 1}/${videoFiles.length}] 开始提取字幕...`, 'info')
        const subtitles = await extractSubtitlesFromMp3(mp3Result.outputPath)
        if (!subtitles) {
          throw new Error('字幕提取失败')
        }
        
        // 保存SRT文件
        addLog(`[${i + 1}/${videoFiles.length}] 开始保存SRT文件...`, 'info')
        const saveSuccess = await saveSrtFile(subtitles as string, file)
        if (!saveSuccess) {
          throw new Error('SRT文件保存失败')
        }
        
        addLog(`[${i + 1}/${videoFiles.length}] 处理成功: ${file.name}`, 'success')
        results.push({ file, success: true })
      } catch (error) {
        addLog(`[${i + 1}/${videoFiles.length}] 处理失败: ${file.name} - ${error instanceof Error ? error.message : String(error)}`, 'error')
        results.push({ file, success: false, error: error instanceof Error ? error.message : String(error) })
      }
    }
    
    setBatchResults(results)
    setBatchProgress(100)
    setIsLoading(false)
    
    // 统计成功和失败的数量
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    
    addLog(`批量处理完成: 成功 ${successCount} 个, 失败 ${failCount} 个`, successCount === results.length ? 'success' : 'info')
  }, [mediaFiles, addLog, convertToMp3ForBatch, extractSubtitlesFromMp3, saveSrtFile])

  // 当对话框打开时，重置状态并开始处理
  useEffect(() => {
    if (isOpen) {
      resetState()
      
      if (isBatchMode) {
        // 批量模式，显示批量处理界面
        addLog(`批量字幕提取模式已启动`, 'info')
        setBatchFiles(mediaFiles.filter(file => file.type === 'video'))
      } else if (mediaFile) {
        // 单文件模式，自动开始处理
        addLog(`开始处理文件: ${mediaFile.name}`, 'info')
        extractSubtitles()
      }
    }
  }, [isOpen, mediaFile, isBatchMode, mediaFiles, extractSubtitles, resetState, addLog])

  if (!isOpen) return null
  
  return (
    <div className="subtitle-extractor-dialog-overlay">
      <div className="subtitle-extractor-dialog">
        <div className="subtitle-extractor-dialog-header">
          <h2>{isBatchMode ? '批量字幕提取' : '字幕提取'}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="subtitle-extractor-dialog-content">
          {isBatchMode ? (
            // 批量模式UI
            <div className="batch-mode-section">
              <div className="batch-info">
                <h3>批量处理文件: {batchFiles.length} 个</h3>
                <div className="batch-progress-container">
                  <div 
                    className="batch-progress-bar" 
                    style={{ width: `${batchProgress}%` }}
                  />
                  <div className="batch-progress-text">
                    {isLoading ? `处理中 ${currentBatchIndex + 1}/${batchFiles.length}` : 
                     batchProgress === 100 ? '处理完成' : '等待开始'}
                  </div>
                </div>
                
                {!isLoading && batchProgress === 0 && (
                  <button 
                    className="start-batch-button"
                    onClick={startBatchProcess}
                  >
                    开始批量处理
                  </button>
                )}
                
                {batchProgress === 100 && (
                  <div className="batch-summary">
                    <div className="summary-title">处理结果摘要:</div>
                    <div className="summary-content">
                      <div className="success-count">成功: {batchResults.filter(r => r.success).length}</div>
                      <div className="fail-count">失败: {batchResults.filter(r => !r.success).length}</div>
                    </div>
                  </div>
                )}
                
                {isLoading && (
                  <div className="current-file-section">
                    <h4>当前处理: {batchFiles[currentBatchIndex]?.name}</h4>
                    <div className="progress-section">
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="progress-steps">
                        <div className={`progress-step ${step === 'converting' ? 'active' : (progress >= 50 ? 'completed' : '')}`}>
                          1. 转换为MP3
                        </div>
                        <div className={`progress-step ${step === 'extracting' ? 'active' : (progress >= 90 ? 'completed' : '')}`}>
                          2. 提取字幕
                        </div>
                        <div className={`progress-step ${step === 'saving' || step === 'completed' ? 'active' : ''} ${step === 'completed' ? 'completed' : ''}`}>
                          3. 保存SRT
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {batchResults.length > 0 && (
                  <div className="batch-results-section">
                    <h4>处理结果:</h4>
                    <div className="batch-results-list">
                      {batchResults.map((result, index) => (
                        <div 
                          key={index} 
                          className={`batch-result-item ${result.success ? 'success' : 'error'}`}
                        >
                          <span className="result-icon">{result.success ? '✓' : '✗'}</span>
                          <span className="result-name">{result.file.name}</span>
                          {!result.success && result.error && (
                            <span className="result-error">{result.error}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // 单文件模式UI
            <>
              <div className="file-info-section">
                <h3>处理文件:</h3>
                <div className="file-info">
                  {mediaFile ? (
                    <>
                      <div className="file-name">{mediaFile.name}</div>
                      <div className="file-path">{mediaFile.path}</div>
                    </>
                  ) : (
                    <div className="no-file">未选择文件</div>
                  )}
                </div>
              </div>
              
              <div className="progress-section">
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="progress-steps">
                  <div className={`progress-step ${step === 'converting' ? 'active' : (progress >= 50 ? 'completed' : '')}`}>
                    1. 转换为MP3
                  </div>
                  <div className={`progress-step ${step === 'extracting' ? 'active' : (progress >= 90 ? 'completed' : '')}`}>
                    2. 提取字幕
                  </div>
                  <div className={`progress-step ${step === 'saving' || step === 'completed' ? 'active' : ''} ${step === 'completed' ? 'completed' : ''}`}>
                    3. 保存SRT
                  </div>
                </div>
              </div>
              
              {result && (
                <div className="result-section">
                  <h3>字幕预览:</h3>
                  <div className="result-content">
                    {result}
                  </div>
                </div>
              )}
            </>
          )}
          
          <div className="logs-section">
            <div className="logs-header">
              <h3>处理日志:</h3>
              <button className="clear-logs-button" onClick={clearLogs}>清除日志</button>
            </div>
            <div className="logs-content">
              {logs.map((log, index) => (
                <div key={index} className={`log-entry log-${log.type}`}>
                  <span className="log-timestamp">[{log.timestamp}]</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubtitleExtractorDialog