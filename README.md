# Night Booth（dj-booth）

夜间 club / emotional house 气质的单页 DJ 舞台：Web Audio 分析驱动小人、碟片与灯光，而不是假循环 GIF。

站名可在 `src/config.ts` 的 `SITE.name` 一处修改。

## Live demo

**https://maggiecycy.github.io/dj-booth/**

（push 到 `main` 后 GitHub Actions 自动部署，约 1–2 分钟生效）

## 产品简介

- 第一屏就是打碟舞台（品牌 + 舞台 + 主控）
- 点击解锁音频后播放 6 首示例曲
- Analyser 频段 → 膝跳 / 手臂 / 灯效 / 碟速
- 切歌有甩碟光效；支持动效强度与 `prefers-reduced-motion`

## 技术选型

| 选择 | 理由 |
|------|------|
| Vite + React + TypeScript | 生态熟、静态可部署、类型安全 |
| Web Audio API（自管） | 学习目标；`decodeAudioData` + `AnalyserNode` |
| Canvas 2D | 2D 分层演出足够；比 Pixi/Three 更轻，数据流更直观 |
| CSS 变量 tokens | 夜间墨色 + 暖琥珀，避开默认紫色 AI 渐变 |

## 目录

```
src/
  audio/          AudioEngine、分析映射、歌单
  scene/          DJScene、PerformanceLoop（rAF）
  ui/             开始遮罩、播放控件
  hooks/          引擎与 a11y hook
  styles/         设计 tokens
public/
  music/          示例音频 + CREDITS
  art/            OG 封面等
scripts/
  generate-demo-tracks.mjs
```

核心数据流：

```
AudioEngine.sampleBands()
  → mapBandsToMotion() / mapBassToBounce() …
  → PerformanceLoop (rAF)
  → DJScene.update/draw()
```

## 如何运行

```bash
npm install
npm run music:generate   # 首次或需要重生成示例曲时
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

GitHub Pages 本地预览（与线上一致的路径）：

```bash
GITHUB_PAGES=true npm run build && npx vite preview --base /dj-booth/
```

部署：push 到 `main` → `.github/workflows/deploy-pages.yml` 自动发布到 GitHub Pages。

## 如何替换我自己的歌曲

1. 把音频放进 **`public/music/`**（当前：`File 1.mp3` … `File 5.mp3` + 一首长文件名 mp3）
2. 编辑 **`src/audio/playlist.ts`** 的 `CATALOG`：改 `title`、`artist`、`category`
3. 文件名有空格时用 `musicSrc('File 1.mp3')` 生成正确 URL
4. 「混搭」= 全部；各 chip = 按 `category` 过滤

浏览器临时添加：进入 booth → **自定义** → 添加本地音频（IndexedDB，不上传服务器）。

## 学习笔记：Web Audio 要点

### 1. AudioContext 必须被用户手势「解锁」

Chrome / Safari 默认 `AudioContext.state === 'suspended'`。不在 click/tap 里 `resume()`，就没有声音，动画也会像「假的」。

本项目在「Enter the booth」按钮里调用 `engine.unlock()` → `ctx.resume()`，再 `play()`。

### 2. decodeAudioData 与 ArrayBuffer

`fetch` 得到的 `ArrayBuffer` 在部分浏览器里会被 `decodeAudioData` **转移（detach）**。稳妥做法是 `raw.slice(0)` 再解码，避免重复预加载时踩「already detached」坑。

BufferSource **只能 start 一次**。暂停/Seek/切歌都要停掉旧 source，再新建一个，用 `offset` 接上进度。

### 3. AnalyserNode：频域聚合，别每帧扫 1024 个 bin 做重活

- `fftSize: 2048`，`smoothingTimeConstant: 0.82`
- 只对低频 / 中频 / 高频几个区间做 `averageRange`
- 映射写成纯函数：`mapBassToBounce`、`mapMidToArm`、`mapEnergyToLights`
- 节拍闪一下用 **能量上升沿（onset 近似）**，不是完美 beat tracking：`delta > threshold` 就拉高 `beatFlash` 再衰减

### 4. 音画同步主循环

`requestAnimationFrame` 在 `PerformanceLoop` 里跑，和 React 解耦：

- React 管 UI（播放键、进度、设置）
- rAF 管采样 → 映射 → Canvas 绘制
- 避免在 React state 里每帧 `setState`（会打爆渲染）

### 5. 自动播放策略（踩过的坑）

- 页面加载时**绝不**自动 `play()`；先画静止舞台 + 遮罩
- 第一次播放必须走用户手势链：`unlock` → `preload` → `play`
- 切歌可以在已解锁的 context 里继续播
- iOS 上若仍无声：检查是否在手势同步调用栈里 `resume`（本项目把 unlock 放在 click handler）

### 6. Canvas 角色演出

没有上 Rive/Lottie：用 Canvas 分层画身体 / 头 / 手臂 / 膝，直接吃 `MotionParams`。好处是音频参数 → 关节角一目了然，方便学习。

## 已知限制

- 示例曲是程序合成的 house 骨架，听感偏「demo」，不是发行级母带
- Onset 检测是能量阈值，慢歌/长 pad 可能误闪或少闪
- `AudioBuffer` 全曲解码占内存；超长播客不适合此架构（应改 MediaElementSource 流式）
- OG 图是 SVG；部分社交平台更吃 PNG/JPG，上线前可再导出一版
- 未做跨曲 crossfade / 真混音器（刻意不做）

## 脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run lint` | oxlint |
| `npm run music:generate` | 重新生成 `public/music/*.wav` |

## 素材许可

见 `public/music/CREDITS.md`。角色与舞台为代码内矢量绘制，无外部插画依赖。
