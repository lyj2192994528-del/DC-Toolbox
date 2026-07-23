# Third-Party Open-Source Notices

DC Toolbox uses and distributes open-source software. Each project remains the property of its respective contributors.

| Project | Purpose | License | Website |
| --- | --- | --- | --- |
| MediaPipe Selfie Segmentation 0.1.1675465747 | Local person segmentation for ID-photo background replacement | Apache License 2.0 | https://github.com/google-ai-edge/mediapipe |
| yt-dlp | Public web media parsing and downloading | Unlicense | https://github.com/yt-dlp/yt-dlp |
| FFmpeg / BtbN FFmpeg-Builds | Bundled audio/video merging component with optional user-triggered online update | LGPL 2.1+ / MIT build scripts | https://ffmpeg.org/ / https://github.com/BtbN/FFmpeg-Builds |
| Electron | Windows desktop runtime | MIT | https://www.electronjs.org/ |
| Vue.js | User interface framework | MIT | https://vuejs.org/ |
| Node SerialPort | Serial-port communication | MIT | https://serialport.io/ |
| iconv-lite | Text encoding conversion | MIT | https://github.com/ashtuchkin/iconv-lite |

The bundled `yt-dlp.exe` is an unmodified official Windows x64 release. Its upstream license dedicates the software to the public domain and provides it without warranty.

DC Toolbox distributes the MediaPipe Selfie Segmentation JavaScript runtime, graph, model and WebAssembly files required by the ID Photo Maker. Processing runs locally on the user's computer. The full Apache License 2.0 text is distributed as `resources/licenses/MEDIAPIPE-APACHE-2.0.txt`.

This software uses an unmodified FFmpeg Windows x64 LGPL build from BtbN FFmpeg-Builds. FFmpeg is licensed under LGPL 2.1 or later; the included build is configured without GPL-only x264/x265 components. The exact binary license is distributed as `resources/tools/FFMPEG-LICENSE.txt`. Corresponding source and reproducible build scripts are available from https://ffmpeg.org/download.html and https://github.com/BtbN/FFmpeg-Builds.

For the complete dependency tree and exact versions, see `package-lock.json`. Full license texts are available from each upstream project and installed package.
