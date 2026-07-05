 # 群晖个人信息网站 — Cloudflare Tunnel 版

 让你在群晖上托管静态个人信息站，通过 Cloudflare Tunnel 走 HTTPS 对外服务，**不需要路由器端口转发**。

 当前版本：单页静态站 + Nginx 容器 + Cloudflare Tunnel 容器。不含后台、数据库、登录系统或动态 API。

 ## 快速启动

 确保群晖装了 Container Manager，项目路径下已有 `.env` 文件（含 `TUNNEL_TOKEN`），然后：

 ```bash
 docker compose up -d
 ```

 或者如果 Compose 插件不兼容：

 ```bash
 docker-compose up -d
 ```

 两个容器都会启动：
 - `personal-site-nginx` — 静态文件服务，局域网端口 8080
 - `personal-site-cloudflared` — 通过 Cloudflare Tunnel 将域名流量转发到 Nginx

 局域网验证：`http://群晖局域网IP:8080`
 公网验证：`https://你的域名`

## 文件说明

- `site/index.html`：个人信息网站首页，替换其中的姓名、简介、链接和联系方式即可。
- `site/styles.css`：页面样式，已包含移动端适配。
- `docker-compose.yml`：群晖 Container Manager 可导入或手动复刻的容器配置。
- `.env.example`：Cloudflare Tunnel token 的环境变量示例，真实 `.env` 不提交到仓库。
- `tests/verify-site.js`：本地结构验收脚本。

## 本地检查

在电脑上先执行：

```bash
node tests/verify-site.js
```

也可以直接打开 `site/index.html`，确认页面内容和样式正常。

 ## 群晖部署步骤

 1. 在群晖 `Container Manager` → 项目 → 新增。
 2. 项目路径选择本仓库所在目录。
 3. 选择 `docker-compose.yml`，项目名称自定（如 `personal-site`）。
 4. **先不要启动** — 先配置 `.env`。
 5. 如果还没有 Cloudflare Tunnel token，可以只启动 `personal-site-nginx` 临时测试。
 6. 访问 `http://群晖局域网IP:8080`，确认能看到个人信息页面。

如果群晖目录不是仓库根目录，请保证 `docker-compose.yml` 同级存在 `site/` 目录。

 ## Cloudflare Tunnel 配置

 1. 登录 Cloudflare 控制台。
 2. 确认域名是否已经接入 Cloudflare；如果还没有接入，先按 Cloudflare 指引把域名 DNS 托管切到 Cloudflare。
 3. 进入 Zero Trust → Networks → Tunnels，创建一个 Tunnel。
 4. 选择 Docker 方式，复制 Cloudflare 生成的 tunnel token。
 5. 在项目目录中创建 `.env` 文件（已存在则更新）：
 
 ```bash
 TUNNEL_TOKEN=这里替换成真实_token
 ```

 6. 在 Container Manager 中启动项目，或执行 `docker compose up -d`。
 7. 回到 Cloudflare 控制台，在 Tunnel 配置页添加 Public Hostname：
    - 子域 / 域名：例如 `www` / `www.dailecheng.xyz`
    - 服务地址：`http://personal-site-nginx:80`
 8. 等待 1-2 分钟，Tunnel 状态变为 ✅ Active。
 9. **访问 `https://你的域名` 确认外网可用。**

 > 如果 Tunnel 状态一直是绿色但不通，检查 `.env` 中的 `TUNNEL_TOKEN` 是否正确，以及 cloudflared 容器日志有无报错。

 ## 外网验收清单

 - [x] `docker compose up -d` 后两个容器都在运行（无 Exited）
 - [x] 局域网 `http://群晖局域网IP:8080` 正常打开
 - [x] Cloudflare Tunnel 后台显示 ✅ Active
 - [x] 手机切到 4G/5G（手机蜂窝网络），打开 `https://www.dailecheng.xyz/photo/` 能正常访问
 - [x] 如果之前是端口暴露访问，**建议关闭路由器的端口转发规则**，只用 Tunnel 这一条公网入口

## 后续可以扩展

- 把占位内容替换为正式头像、简介、项目链接和联系方式。
- 增加多页面、博客、访问统计或自动部署。
- 为域名增加更严格的缓存、安全响应头和备份策略。
