# Market Watchboard

一个基于 React、TypeScript 和 Vite 构建的纯前端市场观察项目，包含 Binance Spot 实时行情看板和 ETF 历史总回报页面。

项目直接在浏览器中读取公开市场数据，不需要登录账号，不保存 API Key，也不提供下单或交易功能。

## 页面与路由

| 路径 | 页面 | 数据方式 |
| --- | --- | --- |
| `/` | Binance Watchboard | Binance 公开 REST API + WebSocket 实时行情 |
| `/etf-returns` | ETF 总回报 | 项目内嵌的静态月度复权数据 |

路由使用 React Router 的 Browser History 模式，不使用 Hash Router。

## 主要功能

### Binance Watchboard

- 拉取 Binance Spot 可交易交易对，并在浏览器中完成模糊搜索
- 使用 REST 快照初始化价格，再通过 WebSocket 持续更新关注列表
- 展示最新价格、24 小时涨跌、高低价、成交额和更新时间
- 支持添加、移除和持久化关注交易对
- 点击交易对打开详情抽屉，查看 K 线和区间行情
- 支持 `1m`、`5m`、`15m`、`1h`、`4h`、`1d`、`1w`、`1M`、`3M` K 线周期

交易对元数据会写入 `sessionStorage` 并缓存 12 小时；关注列表保存在 `localStorage`。

### ETF 总回报

- 在同一个 `/etf-returns` 路由中切换四个标的：QQQ、SPY、盈富基金 02800、南方东英恒生科技 03033
- 默认展示 QQQ，刷新页面后仍回到 QQQ
- 按月度复权收盘价，将初始本金归一化为 10,000 美元或港元
- 展示累计回报、最低金额、最长水下时间、回本月份和重大市场事件区间
- 使用 D3 绘制双坐标轴、水上/水下面积、金额曲线、事件标记和悬停提示
- 数据全部内嵌在项目中，运行时不会请求 Yahoo Finance 或其他 ETF 行情接口

ETF 数据采用现金分红立即再投资的复权口径，未计交易佣金、税费和买卖价差。页面中的具体数据来源和截止月份以图表下方说明为准。

## 技术栈

- React 18
- TypeScript 5
- Vite 5
- React Router 6
- D3 7
- Lightweight Charts 5
- Lucide React

## 项目结构

```text
src/
├── api/                     # Binance REST 和 WebSocket 封装
├── components/              # 跨页面复用的通用组件
├── features/
│   └── etfReturns/          # ETF 图表、静态数据、计算、类型和业务样式
├── hooks/                   # Binance 数据流和关注列表 Hooks
├── pages/                   # 与前端路由对应的页面入口
│   ├── WatchboardPage.tsx
│   └── EtfReturnsPage.tsx
├── types/                   # Binance 数据类型
├── App.tsx                  # 路由配置
└── main.tsx                 # React 与 BrowserRouter 入口
```

目录职责约定：

- `pages` 只放 React Router 直接加载的页面入口
- `features` 放具体业务功能使用的组件、数据、计算和类型
- `components` 放多个页面可以复用的通用组件
- `hooks` 放可复用的 React 状态和数据流逻辑

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

默认访问地址：

- Binance Watchboard：`http://localhost:5173/`
- ETF 总回报：`http://localhost:5173/etf-returns`

## 构建与预览

执行 TypeScript 类型检查并生成生产构建：

```bash
npm run build
```

构建产物输出到 `dist`。

本地预览生产构建：

```bash
npm run preview
```

## 环境变量

项目默认使用 Binance 的公开 market-data-only 地址：

```env
VITE_BINANCE_REST_BASE_URL=https://data-api.binance.vision
VITE_BINANCE_STREAM_BASE_URL=wss://data-stream.binance.vision/stream
```

如需覆盖默认值，可复制 `.env.example` 为 `.env.local` 后修改。不要在任何 `VITE_` 环境变量中保存密钥，因为这些变量会进入前端构建产物。

## 部署

这是一个纯静态 Vite 项目，常用部署配置为：

```text
Build command: npm run build
Output directory: dist
```

由于项目使用 Browser History 路由，静态托管平台需要把 `/etf-returns` 等前端路径回退到根目录的 `index.html`，再由 React Router 完成页面匹配。

## 数据与使用边界

- Binance 页面依赖公开网络接口，接口不可用、网络受限或 WebSocket 断开时，实时行情可能无法加载
- ETF 页面使用项目内嵌历史数据，不会自动更新
- 本项目不处理账户凭证，不读取用户资产，不连接钱包，不执行交易
- 页面内容仅用于行情观察、技术演示和历史数据展示，不构成投资建议
