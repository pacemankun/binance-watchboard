# Binance Watchboard

纯前端 Binance 公开行情关注列表。项目不登录账号、不保存 API Key、不提供后端服务。

## 功能

- 启动时拉取 Binance Spot 交易对元数据，并在 `sessionStorage` 缓存 12 小时
- 搜索框使用前端 `filter` 做模糊搜索
- 关注列表保存在 `localStorage`
- 关注列表价格先用 REST 快照初始化，再用 WebSocket 实时更新
- 支持移除关注交易对

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 环境变量

默认使用 Binance 官方 market-data-only 公开行情接口。需要覆盖地址时，可以参考 `.env.example` 创建 `.env.local`。
