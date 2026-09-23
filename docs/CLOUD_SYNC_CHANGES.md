# 本次云端同步改动清单

以下位置按本次修改完成时的文件行号记录，后续编辑后可能移动；方法名可用于准确搜索。此清单只描述本次云端功能，README 中保留了先前已完成的功能介绍。

## 新增文件

| 文件及位置 | 内容 |
| --- | --- |
| [config/cloud.js:1](../miniprogram/config/cloud.js#L1) | 环境 `cloud1-d1g20bvre49cb67cb`、函数名、10 秒同步间隔 |
| [services/kitchenStore.js:1](../miniprogram/services/kitchenStore.js#L1) | 统一登录与共享状态；第 51 行 `login`、68 行 `refresh`、87 行 `mutate`、104 行 `retry`、135 行 `saveForm`、149 行图片上传、164 行退出登录 |
| [services/pageSync.js:1](../miniprogram/services/pageSync.js#L1) | 列表/详情页订阅、取消订阅和确认对话框 |
| [services/menuActions.js:1](../miniprogram/services/menuActions.js#L1) | 菜单页/详情页共用的选菜、取消、清空购物车、提交菜单 |
| [kitchenApi/index.js:1](../cloudfunctions/kitchenApi/index.js#L1) | 云函数入口、错误响应、成员校验后签发图片链接 |
| [kitchenApi/service.js:13](../cloudfunctions/kitchenApi/service.js#L13) | 可信微信身份、创建/加入/退出厨房、邀请码、事务和写请求去重 |
| [kitchenApi/domain.js:14](../cloudfunctions/kitchenApi/domain.js#L14) | 空厨房数据；第 32 行缺料计算，74 行 `apply` 处理菜谱、库存、购物车、菜单、评价、分类和骰子规则 |
| [kitchenApi/package.json:1](../cloudfunctions/kitchenApi/package.json#L1) | 云函数依赖 `wx-server-sdk` |
| [kitchenApi/config.json:1](../cloudfunctions/kitchenApi/config.json#L1) | 云函数配置；未申请额外开放接口权限 |
| [kitchenApi/database.rules.json:1](../cloudfunctions/kitchenApi/database.rules.json#L1) | 六个业务集合应手动应用的客户端禁止读写规则 |
| [tests/kitchen-sync.test.js:1](../tests/kitchen-sync.test.js#L1) | 43 项本地模拟测试，不连接真实云数据库 |
| [package.json:1](../package.json#L1) | 根目录 `npm test` 入口 |
| [CLOUD_SYNC.md:1](CLOUD_SYNC.md#L1) | 部署步骤、权限要求、保存/重试约定、限制及联调清单 |
| [CLOUD_SYNC_CHANGES.md:1](CLOUD_SYNC_CHANGES.md#L1) | 本改动清单 |

## 修改现有文件

### 初始化与公共工具

| 文件及位置 | 修改内容 |
| --- | --- |
| [app.js:1](../miniprogram/app.js#L1) | 移除运行时示例菜谱/库存，改为空状态、云初始化、身份恢复和前后台同步启停 |
| [app.json:18](../miniprogram/app.json#L18) | 默认导航标题改为“家庭厨房” |
| [utils/category.js:1](../miniprogram/utils/category.js#L1) | 分类从当前厨房云状态加载，保存走云函数，不再恢复公共设备缓存 |
| [utils/ingredient.js:106](../miniprogram/utils/ingredient.js#L106) | 移除直接改写当前菜单/缺料全局状态的旧 `syncOrderIngredients`；保留展示计算及提交前预览工具；同时去掉顶层 `getApp()` 依赖 |
| [README.md:1](../README.md#L1) | 保留原功能介绍，更新登录、云端保存、部署、目录结构、测试与限制 |

### “我的”与家庭管理

| 文件及位置 | 修改内容 |
| --- | --- |
| [mine.js:1](../miniprogram/pages/mine/mine.js#L1) | 登录、创建/加入厨房、邀请码更新/复制、退出、同步状态和待确认操作处理 |
| [mine.wxml:1](../miniprogram/pages/mine/mine.wxml#L1) | 登录卡片、厨房卡片、成员、邀请、重试/草稿界面 |
| [mine.wxss:1](../miniprogram/pages/mine/mine.wxss#L1) | 新界面的卡片、按钮、输入框及成员标签样式 |

### 点菜、冰箱与详情

| 文件及位置 | 修改内容 |
| --- | --- |
| [menu.js:1](../miniprogram/pages/menu/menu.js#L1) | 列表订阅云状态；购物车、随机结果确认走共享写入；未加入厨房/未建分类时提示 |
| [menu.wxml:24](../miniprogram/pages/menu/menu.wxml#L24) | 空状态、图片临时链接；第 58 行仅加入厨房后显示骰子 |
| [fridge.js:1](../miniprogram/pages/fridge/fridge.js#L1) | 读取云端库存及两份清单；第 41 行起取消菜单、移除菜品、确认菜单改为云端操作 |
| [fridge.wxml:23](../miniprogram/pages/fridge/fridge.wxml#L23) | 空状态与私有图片展示 |
| [detailDish.js:1](../miniprogram/pages/detailDish/detailDish.js#L1) | 云端菜品刷新、购物车、删除和评价；处理菜品被其他成员删除的状态 |
| [detailDish.wxml:1](../miniprogram/pages/detailDish/detailDish.wxml#L1) | 无菜品时的保护提示，以及图片临时链接 |
| [detailIngredient.js:1](../miniprogram/pages/detailIngredient/detailIngredient.js#L1) | 云端食材刷新、带版本校验的删除；处理记录不存在 |
| [detailIngredient.wxml:1](../miniprogram/pages/detailIngredient/detailIngredient.wxml#L1) | 无食材时的保护提示，以及图片临时链接 |

### 编辑与分类管理

| 文件及位置 | 修改内容 |
| --- | --- |
| [editDish.js:59](../miniprogram/pages/editDish/editDish.js#L59) | 加入厨房校验、记录原版本与恢复草稿；第 216 行 `saveDish` 上传图片并请求保存；第 288 行 `keepDraft` |
| [editDish.wxml:1](../miniprogram/pages/editDish/editDish.wxml#L1) | 图片临时链接；保存期间禁用编辑控件、显示保存中状态 |
| [editIngredient.js:49](../miniprogram/pages/editIngredient/editIngredient.js#L49) | `saveIngredient` 改为云端保存及图片上传；第 147 行恢复草稿，168 行保留草稿；移除预填分类/状态，补齐日期上限 |
| [editIngredient.wxml:1](../miniprogram/pages/editIngredient/editIngredient.wxml#L1) | 图片临时链接；保存期间禁用编辑控件、显示保存中状态 |
| [categoriesManagement.js:560](../miniprogram/pages/categoriesManagement/categoriesManagement.js#L560) | 编辑分类记录重命名；第 645 行读取分类版本/草稿，670 行云端保存，692 行保留草稿，712 行返回保存 |
| [categoriesManagement.wxml:27](../miniprogram/pages/categoriesManagement/categoriesManagement.wxml#L27) | 添加“保存到家庭厨房”按钮；原生返回时仍会尝试保存 |

### 骰子及购物车展示

| 文件及位置 | 修改内容 |
| --- | --- |
| [randomDishPicker.js:61](../miniprogram/components/randomDishPicker/randomDishPicker.js#L61) | 挂载时读取并订阅共享设置/位置；第 106 行写入改为云端，111 行接收更新，349 行保存时校验版本，430 行结果图片使用临时链接 |
| [randomDishPicker.wxml:115](../miniprogram/components/randomDishPicker/randomDishPicker.wxml#L115) | 设置保存按钮的加载和防重复点击状态 |
| [cart.wxml:25](../miniprogram/components/cart/cart.wxml#L25) | 共享购物车图片优先使用临时链接 |
| [shoppingCart.wxml:68](../miniprogram/components/shoppingCart/shoppingCart.wxml#L68) | 菜单快照图片优先使用临时链接 |

## 保留与未执行的操作

- 没有修改 `miniprogram/styles/listView.wxss`，未改动菜单页原有底部留白样式。
- 分类的长按、拖拽位置计算、边缘滚动、边界高亮算法未改写。
- 骰子 3D 动画、环形长按进度、随机抽取算法保留；变化集中在共享状态读写。
- 没有修改 AppID、项目身份配置、旧 QuickStart 云函数或删除旧缓存/云数据。
- 没有提交 Git commit、创建 PR 或执行真实云端部署。

## 已执行检查

- 43 项本地模拟测试通过。
- 50 个业务 JS/JSON 文件语法/解析检查通过。
- 15 个 WXML、18 个 WXSS 文件通过已安装的微信开发者工具编译器检查。
- `git diff --check` 通过。

以上不是双账号真实云端验收；上线前仍需完成 [部署与联调清单](CLOUD_SYNC.md)。
