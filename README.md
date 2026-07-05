# 群晖个人信息网站 — VPS + frp 版

让你在群晖上托管静态个人信息站，通过子域名 `me.example.com` 解析到腾讯云 VPS，再由 VPS 上的 Nginx 和 frp 转发到家里的群晖。

当前版本：单页静态站 + 群晖 Nginx 容器 + 腾讯云 VPS + frp 隧道 + VPS Nginx HTTPS 反向代理。不含后台、数据库、登录系统或动态 API。

## 当前访问链路

```text
用户浏览器
  ↓
https://me.example.com/
  ↓
DNS 解析到腾讯云 VPS
  ↓
VPS Nginx：80 / 443
  ↓
VPS 本机 127.0.0.1:18080
  ↓
frp 隧道
  ↓
家里群晖 personal-site-nginx：8080 -> 容器 80
```

家里路由器不需要把个人网站端口直接暴露到公网；群晖通过 `frpc` 主动连接 VPS 上的 `frps`。

## 快速启动

确保群晖装了 Container Manager，然后在项目目录启动静态站容器：

```bash
docker compose up -d
```

或者如果 Compose 插件不兼容：

```bash
docker-compose up -d
```

会启动一个容器：
- `personal-site-nginx` — 静态文件服务，群晖局域网端口 `8080`

局域网验证：`http://群晖局域网IP:8080`
公网验证：`https://me.example.com/`

## 文件说明

- `site/index.html`：个人信息网站首页，替换其中的姓名、简介、链接和联系方式即可。
- `site/styles.css`：页面样式，已包含移动端适配。
- `docker-compose.yml`：群晖 Container Manager 可导入或手动复刻的 Nginx 静态站容器配置。
- `docs/vps-frp-deploy.md`：腾讯云 VPS、frp、Nginx 反向代理和 HTTPS 的完整部署记录。
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
4. 启动项目。
5. 访问 `http://群晖局域网IP:8080`，确认能看到个人信息页面。

如果群晖目录不是仓库根目录，请保证 `docker-compose.yml` 同级存在 `site/` 目录。

## 公网部署要点

公网访问不依赖额外的 Tunnel 容器。当前采用的方式是：

1. DNSPod 中把 `me.example.com` 的 A 记录解析到腾讯云 VPS 公网 IP。
2. VPS 上运行 `frps`，监听 `7000`。
3. 群晖上运行 `frpc`，把群晖本机 `8080` 转发到 VPS 本机 `127.0.0.1:18080`。
4. VPS Nginx 监听 `80` 和 `443`，把 `me.example.com` 反向代理到 `http://127.0.0.1:18080`。
5. HTTPS 证书部署在 VPS Nginx 上。

完整命令、配置样例和排查记录见 [docs/vps-frp-deploy.md](docs/vps-frp-deploy.md)。

## 外网验收清单

- [x] `docker compose up -d` 后 `personal-site-nginx` 正常运行（无 Exited）
- [x] 局域网 `http://群晖局域网IP:8080` 正常打开
- [x] DNSPod 中 `me.example.com` 解析到腾讯云 VPS 公网 IP
- [x] VPS 上 `curl -I http://127.0.0.1:18080/` 能返回个人网站
- [x] 手机切到 4G/5G（手机蜂窝网络），打开 `https://me.example.com/` 能正常访问
- [x] 如果之前是端口暴露访问，建议关闭路由器里个人网站相关的公网端口转发规则

## 后续可以扩展

- 把占位内容替换为正式头像、简介、项目链接和联系方式。
- 增加多页面、博客、访问统计或自动部署。
- 为 VPS Nginx 增加更严格的缓存、安全响应头和备份策略。
