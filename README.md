# AI agent for Video Editor - 视频剪辑 MVP

一款基于 Electron + React + FFmpeg.wasm 的轻量级桌面视频剪辑工具。

## 🎯 项目目标

快速交付一款最轻量的视频剪辑工具：
- ✅ 支持单条视频轨道 + 多条音频轨道（4条）
- ✅ 支持实时播放预览
- ✅ 可导入本地素材并快速完成片段裁剪、拼接、导出
- ✅ 支持中英文国际化

## 🚀 功能特性

### 📁 素材空间（Asset Panel）
- 左侧固定宽度 300px 抽屉
- 拖拽或按钮导入视频/音频/图片
- 列表视图：文件名、时长、缩略图（首帧 120×68）
- 右键菜单：删除、在 Finder/Explorer 中显示
- 搜索框（模糊匹配文件名）

### ⏰ 时间线（Timeline）
- 顶部：时间标尺（可缩放 1s-1min/刻度）
- 第1轨：视频轨（锁定高度 80px，标题"V1"）
- 第2-N轨：音频轨（默认4条，高度 60px，标题"A1-A4"）
- 拖拽素材到对应轨道，自动生成 Clip
- Clip 可左右裁剪（hover 出现左右把手，拖动改 in/out 点）
- Clip 可在同轨内拖拽改变位置
- 支持多选（Ctrl/⌘ 点击）后整体移动或删除
- 播放头（红色线）随预览播放实时移动，可手动拖拽跳转

### 🎬 预览窗口（Preview）
- 位置：右上固定
- 16:9 画布（最小 480×270，最大跟随窗口）
- 控制条：播放/暂停（空格键）、上一帧（←）、下一帧（→）、循环开关、音量滑块
- 实时叠加显示当前帧时间码 (HH:MM:SS:FF)

### 📤 导出（Export）
- 入口：菜单 File → Export 或主工具栏
- 分辨率：跟随原视频或 1080p/720p/480p
- 格式：MP4 (H.264 + AAC)
- 帧率、码率：默认与原视频一致，可下拉选择
- 输出路径：记忆上次目录
- 进度：独立模态窗口，显示百分比、剩余时间、取消按钮

## 🛠 技术栈

- **Electron 30+** - 跨平台桌面应用框架
- **Vite 5** - 快速构建工具
- **React 18** - 用户界面库
- **TypeScript** - 类型安全
- **FFmpeg.wasm** - 浏览器端视频处理
- **Zustand** - 轻量级状态管理
- **Lucide React** - 图标库

## 📋 系统要求

- **macOS**: 10.15+ (Catalina)
- **Windows**: Windows 10+
- **内存**: 建议 8GB+
- **CPU**: 支持多核处理器（导出性能相关）

## 🔧 开发环境设置

### 1. 克隆项目
```bash
git clone <repository-url>
cd local_video_cut
```

### 2. 安装依赖
```bash
npm install
```

### 3. 启动开发服务器
```bash
npm run dev
```

### 4. 启动 Electron（新终端窗口）
```bash
npm run electron:dev
```

## 📝 可用脚本

```bash
# 开发模式 - 启动 Vite 开发服务器
npm run dev

# 开发模式 - 启动 Electron + Vite 热重载
npm run electron:dev

# 构建项目
npm run build

# 构建并打包 Electron 应用
npm run build:electron

# 类型检查
npm run type-check

# 代码检查
npm run lint
```

## 🎮 使用指南

### 导入素材
1. 点击左侧素材面板的 `+` 按钮
2. 或者直接拖拽文件到素材面板
3. 支持格式：MP4, MOV, AVI, MKV, MP3, WAV, AAC, JPG, PNG

### 编辑视频
1. 从素材面板拖拽文件到时间线轨道
2. 使用鼠标拖拽调整 Clip 位置
3. 悬停在 Clip 边缘拖拽调整裁剪点
4. 点击预览窗口的播放按钮预览效果

### 快捷键
- `空格` - 播放/暂停
- `←` - 上一帧
- `→` - 下一帧
- `M` - 静音/取消静音
- `Ctrl/⌘ + I` - 导入媒体
- `Ctrl/⌘ + E` - 导出视频

### 导出视频
1. 点击工具栏的"导出"按钮或使用菜单 File → Export Video
2. 选择分辨率、帧率、码率等参数
3. 选择保存位置
4. 等待导出完成

## 🏗 项目结构

```
electron-video-editor/
├── electron/              # Electron 主进程
│   ├── main.ts            # 主进程入口
│   └── preload.ts         # 预加载脚本
├── src/
│   ├── components/        # React 组件
│   │   ├── AssetPanel.tsx # 素材面板
│   │   ├── Timeline.tsx   # 时间线
│   │   ├── Preview.tsx    # 预览窗口
│   │   └── ExportDialog.tsx # 导出对话框
│   ├── store/             # Zustand 状态管理
│   │   └── useEditorStore.ts
│   ├── utils/             # 工具函数
│   │   ├── ffmpeg.ts      # FFmpeg 封装
│   │   └── i18n.ts        # 国际化
│   ├── styles/            # 样式文件
│   │   └── app.css
│   ├── App.tsx            # 主组件
│   └── main.tsx           # React 入口
├── public/                # 静态资源
├── package.json           # 项目配置
├── vite.config.ts         # Vite 配置
└── tsconfig.json          # TypeScript 配置
```

## 🔧 配置说明

### Electron 配置
- 主进程：`electron/main.ts`
- 预加载脚本：`electron/preload.ts`
- 窗口大小：1400×900（最小 1200×700）

### Vite 配置
- 开发服务器端口：5173
- 构建输出：`dist/`
- 支持 Hot Module Replacement

### FFmpeg.wasm 配置
- CDN：unpkg.com/@ffmpeg/core-mt
- 支持多线程处理
- 浏览器端视频转码

## 🐛 已知问题

1. **首次加载 FFmpeg.wasm 较慢** - 需要从 CDN 下载 WASM 文件
2. **大文件处理性能** - 受限于浏览器内存，建议处理 1GB 以下文件
3. **导出速度** - 纯前端转码，速度比原生 FFmpeg 慢

## 🔮 后续开发计划

### 短期目标
- [ ] 改进 Clip 裁剪体验
- [ ] 添加音频波形显示
- [ ] 支持更多视频格式
- [ ] 优化导出性能

### 长期目标
- [ ] 添加视频特效
- [ ] 支持转场效果
- [ ] 添加字幕功能
- [ ] 支持多轨道混音

## 🤝 贡献指南

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) - 浏览器端视频处理
- [React](https://reactjs.org/) - 用户界面库
- [Vite](https://vitejs.dev/) - 现代前端构建工具

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 创建 GitHub Issue
- 发送邮件至：[your-email@example.com]

**Enjoy editing! 🎬✨** 