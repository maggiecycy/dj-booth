# Night Booth

Web Audio + Canvas 2D 的单页 DJ 舞台：音频分析驱动 DJ、人群、灯光与粒子。

**Demo：** https://maggiecycy.github.io/dj-booth/

## 运行

```bash
npm install
npm run dev
```

构建：`npm run build` · 预览：`npm run preview`

## 功能

- 多分类歌单（House / Techno / DnB / Fred again.. / 混搭 / 自定义）
- 曲目列表选歌；底部播放器可展开、拖动、切歌
- 现场灯光面板（灯光 / 激光 / 雾 / 粒子）
- 自定义分类：本地上传（IndexedDB）、删除、排序

## 换歌

1. 音频放入 `public/music/`
2. 编辑 `src/audio/playlist.ts` 的 `CATALOG`
3. 或在页面 **自定义** 里直接添加本地文件

## 结构

```
src/audio/   引擎、歌单、分析
src/scene/   Canvas 舞台与粒子
src/ui/      控件与分类栏
```

数据流：`AudioEngine` → 频段映射 → rAF → `DJScene`

## 部署

Push 到 `main` 后 GitHub Actions 自动发布 Pages（`base: /dj-booth/`）。

## 许可

音乐见 `public/music/CREDITS.md`；舞台与角色为代码内绘制。
