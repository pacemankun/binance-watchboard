# ETF 总回报页面设计规格

## 目标

在现有 React 18、Vite 5、TypeScript 项目中保留 Binance Watchboard 首页，并新增一个基于 History API 的 `/etf-returns` 前端路由。该路由在同一 URL 内展示 QQQ、SPY、盈富基金 02800、南方东英恒生科技 03033 四套总回报图，默认展示 QQQ，通过页面右上角的原生 Select 切换其余三套内容。

四个源 HTML 中的月度复权数据、重大事件区间、金额口径、说明文字和图表交互必须原样迁移到项目内，不访问实时行情接口，也不在运行时依赖源 HTML 文件或外部 CDN。

## 已确认约束

- 现有 Binance Watchboard 继续使用 `/`。
- 新页面路由固定为 `/etf-returns`。
- 使用 React Router 的 Browser History 路由，不使用 Hash Router 或 `#` 锚点。
- 四套 ETF 内容共用 `/etf-returns`，Select 切换不能改变 URL。
- 首次进入和刷新 `/etf-returns` 时默认展示 QQQ，不持久化上一次 Select 选择。
- 图表数据使用四个源 HTML 内嵌的月度数据，不接入 Yahoo Finance 或其他实时接口。
- 保持纯前端架构，不增加 API、Pages Functions、Worker 或传统后端。
- Cloudflare Pages 继续托管 Vite 的 `dist` 构建产物；仓库不生成顶层 `404.html`，以保留 Pages 的默认 SPA History 回退行为。

## 不在本次范围内

- 不修改 Binance 行情数据、关注列表、K 线抽屉或 WebSocket 逻辑。
- 不把 Select 选择写入查询参数、路径参数、Local Storage 或 Session Storage。
- 不自动更新 ETF 月度数据。
- 不增加登录、交易、搜索、筛选、主题切换或独立移动端图表。
- 不迁移 Cloudflare Pages/Workers 架构，不执行生产部署、DNS 或域名修改。

## 方案选择

采用“共享 React 页面结构 + 共享 D3 图表组件 + 四份静态配置”的方案。

不采用以下方案：

- iframe 直接嵌入源 HTML：无法形成可维护的 React 组件，样式、路由和交互边界割裂。
- 为四套内容复制四个组件：页面结构和图表算法高度一致，会产生大量重复代码和后续漂移。
- 将 ETF 标识放进 URL：与“四套页面共用同一个 URL、刷新默认 QQQ”的已确认要求冲突。

## 路由架构

应用根节点由 `BrowserRouter` 包裹，并定义以下路由：

| 路径 | 页面 | 行为 |
| --- | --- | --- |
| `/` | Binance Watchboard | 保留现有功能，并增加 ETF 入口 |
| `/etf-returns` | ETF 总回报页 | 默认 QQQ，Select 在本页内切换配置 |
| `*` | 未知路径 | 使用 React Router 重定向到 `/`，并替换当前 History 记录 |

首页入口使用 React Router 的 `Link`，因此从 `/` 进入 `/etf-returns` 不触发整页刷新。浏览器直接请求或刷新 `/etf-returns` 时由 Cloudflare Pages 返回根 `index.html`，随后由 React Router 匹配页面。

## 首页入口设计

在现有 Watchboard 顶栏右侧增加一个紧凑的导航按钮，文案为“ETF 总回报”。按钮包含折线图图标、文字和向右箭头，复用项目现有 Lucide 图标依赖。

视觉规则：

- 白色背景、细灰绿色边框、8px 圆角，与搜索框和表格卡片保持同一视觉语言。
- 默认文字使用现有深色前景色；悬浮时边框变为项目绿色并轻微上移 1px。
- 保持明显的可点击外观，不复用 WebSocket 状态徽标样式，避免把导航误认为被动状态。
- 键盘聚焦时显示清晰的 focus-visible 轮廓。
- 窄屏时顶栏允许换行，入口保持完整文案，不遮挡标题和连接状态。

## ETF 页面布局

ETF 页面使用独立的宽版容器，与 Watchboard 的业务样式隔离：

1. 顶部导航区左侧提供返回 Binance Watchboard 的文本链接。
2. 主标题区左侧显示“ETF 总回报”和当前标的说明，右上角放置带可见标签的原生 Select。
3. Select 选项顺序固定为：QQQ、SPY、盈富基金 02800、南方东英恒生科技 03033。
4. 主体渲染当前配置对应的总回报图、摘要、图例、事件区间和口径说明。

Select 使用 React 本地状态，初始键固定为 `qqq`。状态只决定当前传入图表组件的配置，不调用 `navigate`，因此切换时 URL 和浏览器 History 长度不变。

## 图表还原

源页面的图表采用固定 `1500 × 620` SVG 几何。本次实现保留相同尺寸、边距、坐标轴、事件带和绘制顺序，以保证桌面视觉和数据位置一致。宽版页面为图表提供足够空间；当视口不足 1500px 时，图表容器横向滚动，不压缩文字或改变坐标几何。

共享图表组件需要还原以下内容：

- 标题、起始月份、初始本金、复权口径和数据截止月份。
- 起始复权价格归一化为 10,000 美元或港元本金后的实际金额。
- 当前金额、累计百分比、最低金额、最低百分比、最长水下时间和回本月份摘要。
- 左轴相对初始本金百分比、右轴实际金额、底轴年份。
- 高于本金的橙色面积、低于本金的粉色面积、实际金额蓝线和 10,000 水位线。
- 五段重大事件区间、事件起止点、区间涨跌幅和上下双行排布。
- 末端数据点、透明指针命中层、垂直十字线、悬浮点和 Tooltip。
- Tooltip 中的月份、插值后的实际金额、相对本金百分比和水上/水下状态。
- 四套源页面各自的美元/港元单位、说明文字和连续数据起点备注。

D3 以 npm 依赖随 Vite 打包，不从 `cdn.jsdelivr.net` 或 `unpkg.com` 加载。React 负责页面和组件生命周期；D3 负责时间/线性比例尺、坐标轴、路径和指针计算。组件在配置变化或卸载时清理旧 SVG 子节点和事件绑定，避免重复绘制。

## 数据模型

每套静态配置使用相同接口：

```ts
type EtfKey = "qqq" | "spy" | "02800" | "03033";

type MonthlyPrice = {
  month: string;
  adjustedClose: number;
};

type MarketEvent = {
  start: string;
  end: string;
  name: string;
  compactName: string;
  kind: "gain" | "loss";
  lane: 0 | 1;
};

type EtfReturnConfig = {
  key: EtfKey;
  selectLabel: string;
  heading: string;
  chartAriaLabel: string;
  currencyPrefix: "$" | "HK$";
  currencyName: "美元" | "港元";
  capital: 10000;
  startLabel: string;
  endLabel: string;
  note: string;
  prices: MonthlyPrice[];
  events: MarketEvent[];
};
```

配置以只读对象导出。解析后的月度数组必须保持源 HTML 的顺序和数值精度：QQQ 320 点、SPY 320 点、02800 224 点、03033 73 点。

## 计算边界

图表计算从 DOM 绘制中分离成纯函数，以便测试：

- 将每个月复权价格按首月价格归一化为本金金额和累计回报百分比。
- 找出累计回报最低点。
- 将连续负回报月份组合为水下区间。
- 计算最长水下区间；已回本时给出回本月份，仍未回本时只给持续时间。
- 计算重大事件起止复权价格的区间涨跌幅。

无效月份、非有限价格或事件端点缺失视为开发期配置错误。测试必须在构建前发现这些问题；运行时若收到未知 Select 值则回退到 QQQ。

## 样式隔离与无障碍

- Watchboard 继续使用现有类名和样式，ETF 新样式统一使用 `etf-` 前缀，避免全局选择器污染。
- Select 必须有可见标签，并可通过键盘操作。
- 首页入口和返回链接具有明确的可访问名称与 focus-visible 状态。
- SVG 保留 `role="img"`、可读的 `aria-label` 和说明性 `desc`。
- Tooltip 设为 `role="tooltip"`，隐藏时同步 `aria-hidden="true"`。
- 对 `prefers-reduced-motion` 用户取消入口悬浮位移和非必要过渡。

## 测试与验收

新增 Vitest、Testing Library 和 jsdom 测试环境，覆盖：

1. `/` 渲染 Watchboard，并存在指向 `/etf-returns` 的入口。
2. `/etf-returns` 默认展示 QQQ。
3. Select 可依次切换 SPY、02800、03033，路径保持 `/etf-returns`。
4. 未知路径重定向到 `/`。
5. 四套静态数据的点数、首月、末月、价格有效性和事件端点完整。
6. 归一化金额、累计回报、最低点、最长水下区间和事件涨跌幅计算正确。

实施完成后执行：

- 自动化测试。
- TypeScript 类型检查和 Vite 生产构建。
- 在 `http://localhost:5173/` 检查首页入口的默认、悬浮、键盘聚焦和窄屏布局。
- 直接访问并刷新 `http://localhost:5173/etf-returns`，确认不会出现前端 404 且默认 QQQ。
- 切换四个选项，确认 URL 不变、标题/单位/数据/事件/说明同步变化。
- 在图表上移动指针，确认十字线、插值点和 Tooltip 正常。
- 检查桌面宽屏完整图表和窄屏横向滚动行为。

## 文件边界

实施计划应沿用以下职责划分，最终文件名可按现有项目约定微调：

- 路由入口：只负责 BrowserRouter 和页面匹配。
- Watchboard 页面：承载现有 Binance 功能和新增入口。
- ETF 页面：负责当前 EtfKey 状态、Select 和宽版布局。
- ETF 配置：只存放四套静态元数据、价格和事件。
- ETF 计算模块：只包含无 DOM 依赖的纯函数。
- ETF 图表组件：只负责将已计算数据绘制为 SVG 并管理指针交互。
- ETF 样式：只包含 `etf-` 前缀的页面和图表样式。
- 测试：分别覆盖路由/交互、数据完整性和计算逻辑。

## 完成标准

当以下条件全部满足时，本功能才算完成：

- 两条路由均能在开发环境和生产构建预览中直接访问。
- 首页入口符合现有项目视觉语言，且键盘和窄屏可用。
- 四套图表内容与源 HTML 的数据、文案、事件和交互一致。
- 切换不改变 URL，刷新默认 QQQ。
- 运行时无外部 ETF 数据或 CDN 请求。
- 自动化测试、类型检查和生产构建全部通过。
- 浏览器完成桌面、窄屏、刷新和四套切换验收。
