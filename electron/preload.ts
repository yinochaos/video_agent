import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  readFile: (path: string): Promise<{ content?: string; success: boolean; error?: string }> => ipcRenderer.invoke('read-file', path),
  readFileAsBuffer: (path: string): Promise<{ buffer?: Buffer; success: boolean; error?: string }> => ipcRenderer.invoke('read-file-as-buffer', path),
  writeFile: (options: { path: string, content: string }) => ipcRenderer.invoke('write-file', options),
  
  // FFmpeg operations
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  runFFmpeg: (options: any) => ipcRenderer.invoke('run-ffmpeg', options),
  convertToMp3: (options: { inputPath: string, outputPath: string, onProgress?: (progress: number) => void }) => {
    if (options.onProgress) {
      ipcRenderer.on('ffmpeg-progress', (event, progress) => options.onProgress!(progress))
    }
    return ipcRenderer.invoke('convert-to-mp3', { inputPath: options.inputPath, outputPath: options.outputPath })
  },
  onFFmpegProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('ffmpeg-progress', (event, progress) => callback(progress))
  },
  
  // Menu events
  onMenuImportMedia: (callback: () => void) => {
    ipcRenderer.on('menu-import-media', callback)
  },
  onMenuExportVideo: (callback: () => void) => {
    ipcRenderer.on('menu-export-video', callback)
  },
  
  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },
  
  // Logging
  log: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => {
    ipcRenderer.send('log', { level, message });
  }
})

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(c => c === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(c => c === child)) {
      return parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { 
    transform: perspective(100px) rotateX(180deg) rotateY(0); 
  }
  50% { 
    transform: perspective(100px) rotateX(180deg) rotateY(180deg); 
  }
  75% { 
    transform: perspective(100px) rotateX(0) rotateY(180deg); 
  }
  100% { 
    transform: perspective(100px) rotateX(0) rotateY(0); 
  }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999) 