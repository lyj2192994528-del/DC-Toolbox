# DC Toolbox v1.1.6

## 新增：一寸照制作

- 本地选择 JPEG、PNG 或 WebP 照片，自动分离人物并替换白、蓝、红或自定义背景。
- 采用标准一寸照画布：25 mm × 35 mm、295 × 413 像素、300 DPI。
- 可调整人物缩放和水平、垂直位置，并在导出前预览。
- 支持两类 JPG 输出控制：
  - 目标文件大小：不限制、约 50 KB、100 KB、200 KB、500 KB、800 KB、1000 KB。
  - JPEG 质量：90%、80%、70%、50%、30%。
- 人像分割完全在本机运行，照片不会上传到网络。

## 开源许可与稳定性

- 集成 MediaPipe Selfie Segmentation `0.1.1675465747`，并随安装包附带完整 Apache License 2.0 文本。
- “帮助 → 开源组件”与 `THIRD_PARTY_NOTICES.md` 已补充组件用途、版本、官网和许可证信息。
- 修复打包后模型与 WebAssembly 资源无法安全加载的问题。
- 修复保存串口自定义波特率设置时可能出现的 Electron IPC 克隆错误。

## 下载说明

- `DC Toolbox-1.1.6-x64-Setup.exe`：Windows x64 安装版。
- `DC Toolbox-1.1.6-x64-Portable.exe`：Windows x64 便携版。

> 本版本未进行代码签名。Windows 首次运行时可能显示 SmartScreen 提示，请确认文件来自本仓库的 Release 页面。
