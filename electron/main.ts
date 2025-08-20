import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import log from 'electron-log'

// Configure electron-log
log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs/main.log');
log.transports.console.level = 'info';
log.transports.file.level = 'info';

// Redirect console to electron-log
Object.assign(console, log.functions);

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist
// │ ├── index.html
// │ ├── assets/
// │ ├── electron-vite.svg
// │ └── electron/
// │     ├── main.js
// │     └── preload.js
// │
process.env.DIST = path.join(__dirname, '..')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(process.env.DIST, '../public')
  : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (process.platform === 'win32') app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, 'preload.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = path.join(process.env.DIST || path.join(__dirname, '..'), 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'Vursor',
    icon: path.join(process.env.VITE_PUBLIC || process.env.DIST || path.join(__dirname, '..'), 'icon.png'),
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Required for FFmpeg.wasm
    },
  })

  if (url) { // electron-vite-vue#298
    win.loadURL(url)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) {
      require('electron').shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// IPC handlers for file operations
ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'aac', 'jpg', 'jpeg', 'png'] },
      { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv'] },
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'ogg'] },
      { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  return result
})

ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog(win!, {
    filters: [
      { name: 'MP4 Video', extensions: ['mp4'] }
    ],
    defaultPath: 'video_export.mp4'
  })
  return result
})

// FFmpeg operations
ipcMain.handle('check-ffmpeg', async () => {
  const { spawn } = require('child_process')
  
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version'])
    
    ffmpeg.on('error', () => {
      resolve({ available: false, error: 'FFmpeg not found' })
    })
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve({ available: true })
      } else {
        resolve({ available: false, error: 'FFmpeg error' })
      }
    })
    
    // Timeout after 5 seconds
    setTimeout(() => {
      ffmpeg.kill()
      resolve({ available: false, error: 'Timeout' })
    }, 5000)
  })
})

ipcMain.handle('run-ffmpeg', async (event, options) => {
  const { spawn } = require('child_process')
  const fs = require('fs')
  const path = require('path')
  const os = require('os')
  
  const { inputFiles, outputPath, command, logoData } = options
  
  console.log('🎬 执行FFmpeg命令:', command)
  
  // 写入PNG logo文件（如果有）
  const tempFiles: string[] = []
  if (logoData && Array.isArray(logoData)) {
    for (const logo of logoData) {
      try {
        const tempPath = path.join(os.tmpdir(), logo.fileName)
        // 从base64数据中提取PNG数据并写入文件
        const base64Data = logo.data.replace(/^data:image\/png;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        fs.writeFileSync(tempPath, buffer)
        tempFiles.push(tempPath)
        console.log(`📸 已写入PNG logo文件: ${tempPath}`)
      } catch (error) {
        console.error(`❌ 写入PNG文件失败:`, error)
      }
    }
  }
  
  return new Promise((resolve, reject) => {
    // 替换命令中的相对路径为绝对路径
    const processedCommand = command.map(arg => {
      // 如果参数匹配logo文件名模式，替换为绝对路径
      if (arg.match(/^text_logo_\d+\.png$/)) {
        return path.join(os.tmpdir(), arg)
      }
      return arg
    })
    
    console.log('🎬 处理后的FFmpeg命令:', processedCommand.join(' '))
    const ffmpeg = spawn('ffmpeg', processedCommand)
    
    let stderr = ''
    let totalDuration = 0
    
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString()
      stderr += output
      
      // Parse duration from FFmpeg output
      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
      if (durationMatch) {
        const hours = parseInt(durationMatch[1])
        const minutes = parseInt(durationMatch[2])
        const seconds = parseInt(durationMatch[3])
        totalDuration = hours * 3600 + minutes * 60 + seconds
      }
      
      // Parse progress
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
      if (timeMatch && totalDuration > 0) {
        const hours = parseInt(timeMatch[1])
        const minutes = parseInt(timeMatch[2])
        const seconds = parseInt(timeMatch[3])
        const currentTime = hours * 3600 + minutes * 60 + seconds
        const progress = Math.min((currentTime / totalDuration) * 100, 100)
        
        // Send progress to renderer
        event.sender.send('ffmpeg-progress', progress)
      }
    })
    
    ffmpeg.on('error', (error) => {
      console.error('❌ FFmpeg进程错误:', error)
      reject(new Error(`FFmpeg进程失败: ${error.message}`))
    })
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('✅ FFmpeg命令执行成功')
        resolve({ success: true, outputPath })
      } else {
        console.error('❌ FFmpeg退出码:', code)
        console.error('错误输出:', stderr)
        reject(new Error(`FFmpeg执行失败 (退出码: ${code})`))
      }
    })
  })
})

// IPC handler for logging from renderer process
ipcMain.on('log', (event, { level, message }) => {
  log[level](message);
});

// Create application menu
const createMenu = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Media',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            win?.webContents.send('menu-import-media')
          }
        },
        { type: 'separator' },
        {
          label: 'Export Video',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            win?.webContents.send('menu-export-video')
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Show Logs in Finder',
          click: () => {
            shell.showItemInFolder(log.transports.file.getFile().path);
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// 文件操作处理程序
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content, success: true };
  } catch (error) {
    console.error('读取文件失败:', error);
    return { error: String(error), success: false };
  }
});

ipcMain.handle('read-file-as-buffer', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    return { buffer, success: true };
  } catch (error) {
    console.error('读取文件为Buffer失败:', error);
    return { error: String(error), success: false };
  }
});

ipcMain.handle('write-file', async (event, options) => {
  const { path, content } = options
  try {
    await fs.writeFile(path, content)
    return { success: true }
  } catch (error) {
    console.error('写入文件失败:', error)
    return { error: String(error), success: false }
  }
})

// MP4转MP3处理程序
ipcMain.handle('convert-to-mp3', async (event, options) => {
  const { inputPath, outputPath } = options
  
  console.log(`🎬 开始将视频转换为MP3: ${inputPath} -> ${outputPath}`)
  
  return new Promise((resolve, reject) => {
    // ffmpeg -i input.mp4 -vn -ar 16000 -ac 1 -b:a 32k -y output.mp3
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '32k',
      '-y',
      outputPath
    ])
    
    let stderr = ''
    let totalDuration = 0
    
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString()
      stderr += output
      
      // Parse duration from FFmpeg output
      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
      if (durationMatch) {
        const hours = parseInt(durationMatch[1])
        const minutes = parseInt(durationMatch[2])
        const seconds = parseInt(durationMatch[3])
        totalDuration = hours * 3600 + minutes * 60 + seconds
      }
      
      // Parse progress
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
      if (timeMatch && totalDuration > 0) {
        const hours = parseInt(timeMatch[1])
        const minutes = parseInt(timeMatch[2])
        const seconds = parseInt(timeMatch[3])
        const currentTime = hours * 3600 + minutes * 60 + seconds
        const progress = Math.min((currentTime / totalDuration) * 100, 100)
        
        // Send progress to renderer
        event.sender.send('ffmpeg-progress', progress)
      }
    })
    
    ffmpeg.on('error', (error) => {
      console.error('❌ FFmpeg进程错误:', error)
      reject({ success: false, error: `FFmpeg进程失败: ${error.message}` })
    })
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('✅ MP3转换成功')
        resolve({ success: true, outputPath })
      } else {
        console.error('❌ FFmpeg退出码:', code)
        console.error('错误输出:', stderr)
        reject({ success: false, error: `FFmpeg执行失败 (退出码: ${code})` })
      }
    })
  })
})

app.whenReady().then(() => {
  createMenu()
}) 