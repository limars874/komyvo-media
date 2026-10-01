# Komyvo Media API Docs

Vue + Vite 的 API 文档站第一版，用于本地预览和后续复刻参考站的模型文档体验。

## 本地运行

```bash
cd api-doc-page
npm install
npm run dev
```

打开终端输出的本地地址，默认可通过以下 hash 直接查看 Seedance 2.5：

```text
http://localhost:5173/#model/doubao-seedance-2-5
```

## 当前范围

- 视频、图片模型目录和搜索
- `#model/<model_id>` 模型锚点路由
- 快速开始代码示例：cURL、Python、JavaScript
- 接口、请求参数、媒体 `role`、状态、计费和错误码
- 复制模型 ID、代码和主题切换
- 使用本地 `src/data.js`，暂不依赖线上 API

正式文档发布前，请再次核对模型数据、价格和接口示例。
