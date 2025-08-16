import React, { useState, useRef } from 'react'
import '../styles/asr-test-dialog.css'

interface AsrTestDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface LogEntry {
  timestamp: string
  message: string
  type: 'info' | 'error' | 'success'
}

const AsrTestDialog: React.FC<AsrTestDialogProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [result, setResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 添加日志
  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
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
  }
  
  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type === 'audio/mpeg' || file.type === 'audio/mp3' || file.name.endsWith('.mp3')) {
        setSelectedFile(file)
        addLog(`已选择文件: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`, 'info')
      } else {
        addLog(`不支持的文件类型: ${file.type}，请选择MP3文件`, 'error')
      }
    }
  }
  
  // 触发文件选择
  const handleSelectFileClick = () => {
    fileInputRef.current?.click()
  }
  
  // 发送ASR请求
  const handleSubmit = async () => {
    if (!selectedFile) {
      addLog('请先选择一个MP3文件', 'error')
      return
    }
    
    setIsLoading(true)
    setResult('')
    addLog('准备发送ASR请求...', 'info')
    
    try {
      const formData = new FormData()
      formData.append('audio_file', selectedFile)
      formData.append('language', 'zh')
      
      addLog(`发送请求到ASR服务: /api/asr/recognize`, 'info')
      addLog(`请求参数: language=zh, 文件=${selectedFile.name}`, 'info')
      
      const startTime = Date.now()
      const response = await fetch('/api/asr/recognize', {
        method: 'POST',
        body: formData,
        // 不需要额外的headers，因为vite.config.ts中已经配置了代理添加Authorization头
      })
      
      const endTime = Date.now()
      const duration = ((endTime - startTime) / 1000).toFixed(2)
      
      if (!response.ok) {
        throw new Error(`服务器返回错误: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      addLog(`请求成功完成，耗时 ${duration} 秒`, 'success')
      
      if (data.text) {
        setResult(data.text)
        addLog(`成功提取文本，长度: ${data.text.length} 字符`, 'success')
      } else {
        addLog('响应中没有找到文本内容', 'error')
      }
      
      // 记录完整响应
      addLog(`完整响应: ${JSON.stringify(data, null, 2)}`, 'info')
    } catch (error) {
      addLog(`请求失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }
  
  // 清除日志
  const clearLogs = () => {
    setLogs([])
    addLog('日志已清除', 'info')
  }
  
  if (!isOpen) return null
  
  return (
    <div className="asr-test-dialog-overlay">
      <div className="asr-test-dialog">
        <div className="asr-test-dialog-header">
          <h2>ASR语音识别测试</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="asr-test-dialog-content">
          <div className="file-selection-section">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".mp3,audio/mpeg"
              style={{ display: 'none' }}
            />
            <button 
              className="select-file-button"
              onClick={handleSelectFileClick}
            >
              选择MP3文件
            </button>
            <div className="selected-file">
              {selectedFile ? selectedFile.name : '未选择文件'}
            </div>
            <button 
              className={`submit-button ${isLoading ? 'loading' : ''}`}
              onClick={handleSubmit}
              disabled={!selectedFile || isLoading}
            >
              {isLoading ? '处理中...' : '提取文本'}
            </button>
          </div>
          
          <div className="result-section">
            <h3>识别结果:</h3>
            <div className="result-content">
              {result || '等待识别...'}
            </div>
          </div>
          
          <div className="logs-section">
            <div className="logs-header">
              <h3>日志:</h3>
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

export default AsrTestDialog