# Night Booth

[![justforfunnoreally.dev badge](https://img.shields.io/badge/justforfunnoreally-dev-9ff)](https://justforfunnoreally.dev)

A beat-reactive DJ booth in the browser — for fun.  
浏览器里的节拍驱动 DJ 舞台 —— 纯好玩。

**Live demo / 在线演示：** https://maggiecycy.github.io/dj-booth/

---

## Why tho? / 这是干嘛的？

**EN**

Bored listening to Spotify while nothing on screen moves with you?  
Sick of club smoke / bad vibes / that whole night-out mess?  
Wanna throw a tiny booth with friends — at home, projects on the table, no cover charge?

**Use this.**

Hit play. Watch the DJ, the crowd, the lasers, and the floor wave move with the music.  
Toss bottles, vinyl, cash, beach balls from the side rails.  
Send a vibe to the crowd. Be the booth.

**中文**

听 Spotify 听到麻木、屏幕上却一点现场感都没有？  
受够了酒吧烟雾、黏地板、莫名其妙的局？  
想和朋友在家开一场小舞台 —— 一台电脑就够，不用门票？

**用这个。**

按下播放：DJ、人群、激光、底部音波跟着节拍动。  
左右 Toss 扔瓶子、唱片、钞票、彩球……  
给人群发一句 vibe。今晚你就是 booth。

---

## Features / 功能

| | EN | 中文 |
|---|----|------|
| **Stage** | Canvas 2D booth: DJ, decks, crowd, lights, lasers, haze, particles | Canvas 舞台：DJ、唱盘、人群、灯光、激光、雾、粒子 |
| **Audio-reactive** | Local files drive real Web Audio analysis → bounce, flash, spectrum | 本地音频走真频谱分析，驱动律动与闪光 |
| **Wave** | Bottom visualizer styles (mirror / dots / ribbon / neon / off) | 底部音波多种样式（Venue 面板可切换） |
| **Toss** | Collapsible side rails — throw club props onto the stage | 可折叠侧栏，往舞台扔道具 |
| **Library** | Built-in genres + Custom: local upload **or** Spotify playlists | 内置分类 + 自定义：本地上传 **或** Spotify 歌单 |
| **Venue** | Tune lights / lasers / haze / particles / fog / wave | 现场灯光与特效强度可调 |
| **Crowd chat** | Type a vibe; bubbles pop over the floor | 底部发 vibe，人群冒气泡 |

> **Spotify note:** Needs Premium + “Enable player”. Spotify audio can’t feed the browser Analyser, so stage motion uses a BPM/duration arrangement (still breathes through intro → build → drop). Local tracks = full beat sync.  
> **Spotify 说明：** 需要 Premium 并 Enable player。Spotify 音频进不了浏览器 Analyser，舞台用 BPM/时长段落驱动；本地曲目才是完整跟拍。

---

## Quick start / 本地运行

```bash
npm install
npm run dev
```

Build / 构建：`npm run build` · Preview / 预览：`npm run preview`

Optional Spotify (`.env.local`):

```bash
VITE_SPOTIFY_CLIENT_ID=your_client_id
```

Redirect URIs: `http://127.0.0.1:5173/callback` and your Pages callback.

---

## Add music / 换歌

1. Drop files into `public/music/`
2. Edit `CATALOG` in `src/audio/playlist.ts`
3. Or use **Library → Local file** / **Spotify** in the app (no redeploy)

---

## Project layout / 结构

```
src/audio/    engine, playlist, analysis
src/scene/    canvas stage, particles, props, wave
src/spotify/  OAuth + playback helpers
src/ui/       console, library, toss rails, venue
```

Flow: `AudioEngine` → bands / spectrum → rAF → `DJScene`

---

## Deploy / 部署

Push to `main` → GitHub Actions → GitHub Pages (`base: /dj-booth/`).  
Large music assets may be served via CDN in production builds.

---

## Credits & license / 许可

- Music: see `public/music/CREDITS.md` — personal demo; respect artists & rights.  
  音乐版权见 CREDITS；本站为个人演示，请尊重版权。
- Art notes: `public/art/CREDITS.md`
- Stage characters & FX are drawn in code.  
  舞台角色与特效为代码绘制。

---

*Not a startup. Not a Spotify killer. Just a booth you can open with friends when the night needs a little more light.*  
*不是创业项目，也不是要取代谁。只是晚上想多一点灯时，和朋友一起打开的小舞台。*
