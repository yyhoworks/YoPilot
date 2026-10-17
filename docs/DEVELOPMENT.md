# 开发与检查

## 环境

运行时：现代浏览器 + 已启用的 OxiDNS 原生 API/WebUI。无需 Node、Python、Rust、数据库或其他常驻服务。

开发测试：Node.js 22+。打包使用 Python 3.10+；交互式 SSH 发布额外安装 `requirements.txt`。

```sh
npm test
npm run check
npm run package
```

不需要 `npm install`，前端测试只使用 Node 内置模块，运行依赖已自托管。

## 可选云端检查

`docs/examples/frontend-check.yml` 是 GitHub Actions 模板，默认没有启用。仓库管理员可将它复制到 `.github/workflows/check.yml` 后提交，使用 GitHub 托管环境运行前端测试并打包静态资源。写入工作流需要对应 GitHub 权限；当前公开源码发布不要求扩大凭据权限，也不包含自动部署到 DNS 设备的步骤。

## 修改静态入口

`index.html` 是部署首页，`oxidns-console-prototype.html` 是兼容入口，内容需一致。修改后同时更新两者及改动资源的缓存版本。

静态发布范围由 `web-assets.json` 指定。新增/移除资源后，检查文件内容再运行：

```sh
node scripts/check-assets.cjs --write-manifest
npm run check
```

打包器只读取清单。禁止把配置、数据库、规则下载文件、密码、浏览器资料、截图原图或后端源码加入清单。

## 测试边界

模型与界面 fixture 测试覆盖字段保留、版本冲突、原生 transport、动态集合、缓存、拓扑与统计语义、输入差异和过期响应等。它们不是所有编译特性、平台与协议的生产写入证明。

生产验收应优先只读：健康、build、配置版本、静态资源、原生页面和正常 DNS 查询。不要用清生产缓存/历史、改分流或重启来测试 UI。

需要核对更新后的 OxiDNS 定义时，在仓库外单独下载官方源码，再运行：

```sh
node --disable-warning=ExperimentalWarning scripts/audit-upstream.cjs /path/to/oxidns
```

这是只读目录/Schema 对比，不是编译。不要将检查用的后端源码提交到本仓库。

## 截图

使用实际前端界面，记录后端版本、主题和捕获范围。对服务地址、客户端、查询域名、响应、私有订阅、令牌和本地路径脱敏；不要公开配置编辑器原文。UI 的示意/采样说明应保留在截图中。

## 提交前

- 检查 Git diff 与 staged 文件，不使用工作目录的无差别上传。
- 确保未新增后端、未改原生 API 路径和配置格式。
- 保留第三方声明、字体许可证和未知参数路径。
- 运行测试、资源检查与静态打包；确认包内没有任何运行数据。
