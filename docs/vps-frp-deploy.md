# 腾讯云 VPS + frp 隐藏端口部署记录

本文记录本次已经跑通的部署流程：不使用 Cloudflare，通过腾讯云服务器和 frp 把群晖里的个人网站发布到公网，并隐藏真实端口。

## 目标架构

```text
用户浏览器
  ↓
https://me.dailecheng.xyz
  ↓
腾讯云 VPS：80 / 443
  ↓
VPS Nginx 反向代理
  ↓
VPS 本机 127.0.0.1:18080
  ↓
frp 隧道
  ↓
家里群晖 personal-site-nginx：8080 -> 容器 80
```

公网用户只访问标准端口：

```text
http://me.dailecheng.xyz
https://me.dailecheng.xyz
```

不再暴露这些端口：

```text
:25081
:5081
:8080
```

## 当前已跑通结果

群晖 `frpc` 已成功连接腾讯云 VPS：

```text
login to server success
proxy added: [personal-site]
start proxy success
```

VPS 上测试 frp 隧道成功：

```sh
curl -I http://127.0.0.1:18080/
```

返回过：

```text
HTTP/1.1 200 OK
Server: nginx/1.27.5
Content-Length: 2690
```

`me.dailecheng.xyz` 通过 HTTP 已可访问：

```sh
curl -I http://me.dailecheng.xyz/
```

返回过：

```text
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
```

## 一、腾讯云服务器准备

推荐配置：

```text
系统：Ubuntu 22.04 LTS 或 Debian 12
配置：1 核 2G 起步
带宽：3Mbps 起步
```

腾讯云安全组 / 防火墙需要放行：

```text
80/tcp
443/tcp
7000/tcp
```

不需要对公网放行：

```text
18080/tcp
8080/tcp
5081/tcp
25081/tcp
```

## 二、DNSPod 解析设置

把需要隐藏端口的子域名解析到腾讯云 VPS 公网 IP。

例如 VPS 公网 IP 是 `1.2.3.4`：

```text
me      A      1.2.3.4
www     A      1.2.3.4
photo   A      1.2.3.4
```

本次先跑通的是：

```text
me.dailecheng.xyz
```

如果之前群晖里有 DNSPod-DDNS 自动更新任务，需要先停用，避免它把 `me.dailecheng.xyz` 或 `www.dailecheng.xyz` 改回家庭公网 IP。

检查解析：

```sh
nslookup me.dailecheng.xyz
```

结果应该是腾讯云 VPS 公网 IP，而不是家里的公网 IP。

## 三、VPS 安装 frps

SSH 登录 VPS：

```sh
ssh ubuntu@你的VPS公网IP
```

如果使用 `ubuntu` 用户，系统管理命令要加 `sudo`。

安装基础工具：

```sh
sudo apt update
sudo apt install -y wget tar nginx
```

下载 frp：

```sh
cd /opt
sudo wget -O frp_0.64.0_linux_amd64.tar.gz \
https://github.com/fatedier/frp/releases/download/v0.64.0/frp_0.64.0_linux_amd64.tar.gz
```

如果 GitHub 下载卡住，可换代理地址：

```sh
cd /opt
sudo wget -O frp_0.64.0_linux_amd64.tar.gz \
https://gh-proxy.com/https://github.com/fatedier/frp/releases/download/v0.64.0/frp_0.64.0_linux_amd64.tar.gz
```

解压：

```sh
cd /opt
sudo tar -xzf frp_0.64.0_linux_amd64.tar.gz
sudo mv frp_0.64.0_linux_amd64 frp
```

验证：

```sh
/opt/frp/frps -v
```

## 四、VPS 配置 frps

生成一个随机 token：

```sh
openssl rand -hex 32
```

编辑配置：

```sh
sudo nano /opt/frp/frps.toml
```

内容：

```toml
bindPort = 7000

auth.method = "token"
auth.token = "替换成你的随机token"
```

保存 `nano` 文件：

```text
Ctrl + O
Enter
Ctrl + X
```

创建 systemd 服务：

```sh
sudo nano /etc/systemd/system/frps.service
```

内容：

```ini
[Unit]
Description=frp server
After=network.target

[Service]
Type=simple
ExecStart=/opt/frp/frps -c /opt/frp/frps.toml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动：

```sh
sudo systemctl daemon-reload
sudo systemctl enable frps
sudo systemctl start frps
sudo systemctl status frps
```

看到下面状态表示成功：

```text
Active: active (running)
```

退出 `status` 页面：

```text
q
```

查看日志：

```sh
sudo journalctl -u frps -f
```

## 五、群晖安装 frpc

SSH 登录群晖：

```sh
ssh dyf8430@192.168.1.210
```

确认 CPU 架构：

```sh
uname -m
```

如果输出是 `x86_64`，使用 linux amd64 版本：

```sh
mkdir -p /var/services/homes/dyf8430/frp
cd /var/services/homes/dyf8430/frp
wget https://gh-proxy.com/https://github.com/fatedier/frp/releases/download/v0.64.0/frp_0.64.0_linux_amd64.tar.gz
tar -xzf frp_0.64.0_linux_amd64.tar.gz
cp frp_0.64.0_linux_amd64/frpc .
chmod +x frpc
```

如果下载慢，可以换：

```sh
wget https://gh.llkk.cc/https://github.com/fatedier/frp/releases/download/v0.64.0/frp_0.64.0_linux_amd64.tar.gz
```

## 六、群晖配置 frpc

编辑配置：

```sh
vi /var/services/homes/dyf8430/frp/frpc.toml
```

内容：

```toml
serverAddr = "你的腾讯云VPS公网IP"
serverPort = 7000

auth.method = "token"
auth.token = "和VPS上frps.toml里完全一样的token"

[[proxies]]
name = "personal-site"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8080
remotePort = 18080
```

说明：

```text
localPort = 8080
```

表示群晖本机访问个人网站的端口。如果局域网访问地址是：

```text
http://192.168.1.210:8080
```

这里就填 `8080`。

如果要同时转发群晖应用，继续追加这些 proxy。本次新增的子域名和端口是：

```text
photo.dailecheng.xyz      群晖 5080 / 5081
download.dailecheng.xyz   群晖 8100 / 8101
audio.dailecheng.xyz      群晖 8800 / 8801
```

推荐外部 HTTPS 由 VPS Nginx 负责。后端可以先走 HTTP 端口：

```toml
[[proxies]]
name = "photo"
type = "tcp"
localIP = "127.0.0.1"
localPort = 5080
remotePort = 15080

[[proxies]]
name = "download"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8100
remotePort = 18100

[[proxies]]
name = "audio"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8800
remotePort = 18800
```

Synology Photos 如果页面一直刷新，可以再增加一条 HTTPS 后端映射：

```toml
[[proxies]]
name = "photo-https"
type = "tcp"
localIP = "127.0.0.1"
localPort = 5081
remotePort = 15081
```

启动测试：

```sh
/var/services/homes/dyf8430/frp/frpc -c /var/services/homes/dyf8430/frp/frpc.toml
```

成功日志类似：

```text
login to server success
proxy added: [personal-site]
start proxy success
```

这个终端窗口保持运行，先不要关。

## 七、VPS 测试 frp 隧道

回到 VPS 执行：

```sh
curl -I http://127.0.0.1:18080/
```

如果返回 `200 OK`，说明：

```text
VPS -> frp -> 群晖个人网站
```

已经打通。

如果返回 `connection refused` 或超时，重点检查群晖 `frpc.toml`：

```toml
localIP = "127.0.0.1"
localPort = 8080
```

确认 `localPort` 是群晖上真实能访问个人网站的端口。

如果配置了群晖应用，也在 VPS 上测试这些本地端口：

```sh
curl -I http://127.0.0.1:15080/
curl -I http://127.0.0.1:18100/
curl -I http://127.0.0.1:18800/
curl -k -I https://127.0.0.1:15081/
```

判断方式：

```text
127.0.0.1:15080 -> 群晖 Photo HTTP 入口
127.0.0.1:18100 -> 群晖 Download HTTP 入口
127.0.0.1:18800 -> 群晖 Audio HTTP 入口
127.0.0.1:15081 -> 群晖 Photo HTTPS 入口
```

## 八、VPS 配置 Nginx 反向代理

编辑 Nginx 配置：

```sh
sudo nano /etc/nginx/sites-available/dailecheng.conf
```

如果只配置 `me.dailecheng.xyz`：

```nginx
server {
    listen 80;
    server_name me.dailecheng.xyz;

    location / {
        proxy_pass http://127.0.0.1:18080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

如果 `www` 和 `me` 都指向同一个个人网站：

```nginx
server {
    listen 80;
    server_name www.dailecheng.xyz me.dailecheng.xyz;

    location / {
        proxy_pass http://127.0.0.1:18080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```sh
sudo ln -s /etc/nginx/sites-available/dailecheng.conf /etc/nginx/sites-enabled/dailecheng.conf
sudo nginx -t
sudo systemctl reload nginx
```

测试：

```sh
curl -I http://me.dailecheng.xyz/
```

如果返回 `200 OK`，端口隐藏已经跑通。

注意：此时返回头里的 `Server` 可能显示 VPS 的 Nginx：

```text
Server: nginx/1.24.0 (Ubuntu)
```

这是正常的。重点看网页内容是否来自群晖个人网站。

群晖应用的 HTTP 反向代理可以追加：

```nginx
server {
    listen 80;
    server_name photo.dailecheng.xyz;

    location / {
        proxy_pass http://127.0.0.1:15080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name download.dailecheng.xyz;

    location / {
        proxy_pass http://127.0.0.1:18100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name audio.dailecheng.xyz;

    location / {
        proxy_pass http://127.0.0.1:18800;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 九、添加 HTTPS

HTTPS 证书建议部署在腾讯云 VPS 上，因为公网浏览器连接的是 VPS 的 `443` 端口。

本次最终采用 `acme.sh + DNSPod API` 申请通配符证书，避免 certbot HTTP 校验反复命中 DNSPod 旧缓存或 `webblock` 页面。

通配符证书包含：

```text
dailecheng.xyz
*.dailecheng.xyz
```

可覆盖：

```text
me.dailecheng.xyz
photo.dailecheng.xyz
download.dailecheng.xyz
audio.dailecheng.xyz
www.dailecheng.xyz
```

### 安装 acme.sh

如果 `curl https://get.acme.sh | sh` 很慢，可以下载完整仓库压缩包：

```sh
cd /tmp
wget -O acme.sh.zip https://gh-proxy.com/https://github.com/acmesh-official/acme.sh/archive/refs/heads/master.zip
sudo apt install -y unzip
unzip acme.sh.zip
cd acme.sh-master
./acme.sh --install --home ~/.acme.sh --accountemail dyf-843@163.com
```

设置默认 CA：

```sh
~/.acme.sh/acme.sh --set-default-ca --server letsencrypt
```

### 申请通配符证书

先在当前 VPS 终端设置腾讯云 DNSPod API 密钥。不要把密钥写进文档或发给别人：

```sh
export Tencent_SecretId="你的SecretId"
export Tencent_SecretKey="你的SecretKey"
```

申请证书：

```sh
~/.acme.sh/acme.sh --issue \
  --dns dns_tencent \
  -d dailecheng.xyz \
  -d "*.dailecheng.xyz" \
  --keylength 2048 \
  --dnssleep 120 \
  --server letsencrypt
```

### 安装证书到 Nginx

普通用户不能直接写 `/etc/nginx`，先安装到用户目录，再复制到 Nginx 目录：

```sh
mkdir -p /home/ubuntu/certs/dailecheng.xyz

~/.acme.sh/acme.sh --install-cert -d dailecheng.xyz \
  --key-file /home/ubuntu/certs/dailecheng.xyz/privkey.pem \
  --fullchain-file /home/ubuntu/certs/dailecheng.xyz/fullchain.pem

sudo mkdir -p /etc/nginx/ssl/dailecheng.xyz
sudo cp /home/ubuntu/certs/dailecheng.xyz/privkey.pem /etc/nginx/ssl/dailecheng.xyz/privkey.pem
sudo cp /home/ubuntu/certs/dailecheng.xyz/fullchain.pem /etc/nginx/ssl/dailecheng.xyz/fullchain.pem
sudo chmod 600 /etc/nginx/ssl/dailecheng.xyz/privkey.pem
sudo chmod 644 /etc/nginx/ssl/dailecheng.xyz/fullchain.pem
```

Nginx HTTPS server 都使用这张通配符证书：

```nginx
ssl_certificate /etc/nginx/ssl/dailecheng.xyz/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/dailecheng.xyz/privkey.pem;
```

### 群晖应用 HTTPS 配置

`photo` 最终建议走群晖 HTTPS 端口 `5081`，也就是 VPS 的 `15081`：

```nginx
server {
    listen 443 ssl;
    server_name photo.dailecheng.xyz;

    ssl_certificate /etc/nginx/ssl/dailecheng.xyz/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/dailecheng.xyz/privkey.pem;

    location / {
        proxy_pass https://127.0.0.1:15081;
        proxy_ssl_verify off;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port 443;
        proxy_set_header X-Forwarded-Ssl on;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_redirect off;
        proxy_buffering off;
    }
}
```

`download` 和 `audio` 可以先走各自 HTTP 后端：

```nginx
server {
    listen 443 ssl;
    server_name download.dailecheng.xyz;

    ssl_certificate /etc/nginx/ssl/dailecheng.xyz/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/dailecheng.xyz/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:18100;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port 443;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_redirect off;
        proxy_buffering off;
    }
}

server {
    listen 443 ssl;
    server_name audio.dailecheng.xyz;

    ssl_certificate /etc/nginx/ssl/dailecheng.xyz/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/dailecheng.xyz/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:18800;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port 443;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_redirect off;
        proxy_buffering off;
    }
}
```

修改后检查并重载：

```sh
sudo nginx -t
sudo systemctl reload nginx
```

测试：

```sh
curl -I https://photo.dailecheng.xyz/
curl -I https://download.dailecheng.xyz/
curl -I https://audio.dailecheng.xyz/
```

## 十、确认 acme.sh 自动续期

`acme.sh` 安装时通常会自动写入当前用户的 crontab，用于定期续期。

检查：

```sh
crontab -l | grep acme.sh
```

手动模拟续期可以使用：

```sh
~/.acme.sh/acme.sh --renew -d dailecheng.xyz --server letsencrypt --force
```

如果续期成功，还需要把新证书复制到 Nginx 目录并重载。可以沿用安装证书时的命令：

```sh
~/.acme.sh/acme.sh --install-cert -d dailecheng.xyz \
  --key-file /home/ubuntu/certs/dailecheng.xyz/privkey.pem \
  --fullchain-file /home/ubuntu/certs/dailecheng.xyz/fullchain.pem

sudo cp /home/ubuntu/certs/dailecheng.xyz/privkey.pem /etc/nginx/ssl/dailecheng.xyz/privkey.pem
sudo cp /home/ubuntu/certs/dailecheng.xyz/fullchain.pem /etc/nginx/ssl/dailecheng.xyz/fullchain.pem
sudo systemctl reload nginx
```

后续自动续期依赖：

```text
DNSPod API 密钥仍有效
DNSPod 仍托管 dailecheng.xyz
VPS 能访问 Let's Encrypt 和腾讯云 DNSPod API
```

## 十一、让群晖 frpc 后台运行

手动测试时，群晖终端里的 `frpc` 在前台运行。

临时停止：

```text
Ctrl + C
```

后台运行：

```sh
nohup /var/services/homes/dyf8430/frp/frpc -c /var/services/homes/dyf8430/frp/frpc.toml >> /var/services/homes/dyf8430/frp/frpc.log 2>&1 &
```

检查进程：

```sh
ps aux | grep frpc
```

查看日志：

```sh
tail -f /var/services/homes/dyf8430/frp/frpc.log
```

## 十二、群晖任务计划开机启动 frpc

在 DSM 中进入：

```text
控制面板
  -> 任务计划
  -> 新增
  -> 触发的任务
  -> 用户定义的脚本
```

建议配置：

```text
任务名称：frpc-start
用户：dyf8430
事件：开机
启用：勾选
```

脚本：

```sh
nohup /var/services/homes/dyf8430/frp/frpc -c /var/services/homes/dyf8430/frp/frpc.toml >> /var/services/homes/dyf8430/frp/frpc.log 2>&1 &
```

保存后可以手动运行一次，再检查：

```sh
ps aux | grep frpc
tail -n 50 /var/services/homes/dyf8430/frp/frpc.log
```

## 十三、跑稳后清理旧方案

确认 `https://me.dailecheng.xyz/` 通过手机 4G/5G 稳定访问后，再逐步关闭旧入口。

建议先停用，不要马上删除：

```text
群晖 DDNS / DNSPod-DDNS 任务
路由器 25081 -> 5081 端口转发
路由器 80 / 443 端口转发
旧的 Web Station 对外入口
```

新方案里，域名应指向腾讯云 VPS，不再指向家庭公网 IP。

家里路由器理论上不需要开放入站端口，因为群晖是主动连接 VPS 的 `7000` 端口。

## 十四、常见问题

### 1. `apt update` 提示 Permission denied

原因是当前是普通用户 `ubuntu`。

使用：

```sh
sudo apt update
sudo apt install -y wget tar nginx
```

或者切到 root：

```sh
sudo -i
```

### 2. `me.dailecheng.xyz` 仍解析到家庭公网 IP

常见原因：

```text
DNSPod 还有旧记录
本地 DNS 缓存未刷新
群晖 DNSPod-DDNS 任务又把记录改回家里 IP
```

处理：

```text
确认 DNSPod 记录值是 VPS 公网 IP
停用群晖 DNSPod-DDNS 任务
等待 DNS 缓存刷新
```

### 3. `curl http://127.0.0.1:18080/` 失败

说明 VPS 到群晖的 frp 隧道或群晖本地端口有问题。

检查：

```text
VPS frps 是否 running
腾讯云安全组是否放行 7000
群晖 frpc 是否 login success
frpc.toml token 是否和 frps.toml 完全一致
frpc.toml localPort 是否正确
```

### 4. 域名打开是 Ubuntu Nginx 默认页

说明域名已经到 VPS，但 Nginx 没有命中反向代理配置。

检查：

```sh
sudo nginx -t
sudo systemctl reload nginx
```

并确认 `server_name` 包含当前访问的域名：

```nginx
server_name me.dailecheng.xyz;
```

### 5. HTTPS 证书续期是否还要手动加任务

当前使用的是 `acme.sh` 通配符证书，不再依赖 certbot 的 HTTP 校验。

检查：

```sh
crontab -l | grep acme.sh
```

如果需要手动续期和安装，参考“确认 acme.sh 自动续期”章节。

### 6. `https://photo.dailecheng.xyz/` 页面一直刷新

如果 `curl` 没有 301/302 循环：

```sh
curl -k -I -L --max-redirs 5 https://photo.dailecheng.xyz/
```

但浏览器页面一直刷新，通常不是 VPS Nginx 跳转问题，而是 Synology Photos 对外部入口识别不一致。

处理顺序：

```text
1. frpc 增加 photo-https：群晖 5081 -> VPS 15081
2. VPS Nginx 的 photo 443 配置改为 proxy_pass https://127.0.0.1:15081
3. proxy_ssl_verify off
4. 群晖 DSM 登录门户里把 Synology Photos 改成独立域名 photo.dailecheng.xyz
5. 不再依赖 www.dailecheng.xyz/photo/ 路径别名
6. 浏览器用无痕窗口或清除 photo.dailecheng.xyz 站点数据后再试
```

关键验证：

```sh
curl -k -I https://127.0.0.1:15081/
curl -k -I https://photo.dailecheng.xyz/
```

## 后续扩展

可以按同样方式增加更多服务：

```text
www.dailecheng.xyz    -> 个人网站
me.dailecheng.xyz     -> 个人网站或另一个服务
photo.dailecheng.xyz  -> 群晖照片服务
download.dailecheng.xyz -> 群晖 Download
audio.dailecheng.xyz    -> 群晖 Audio
```

每增加一个服务，一般需要：

```text
1. DNSPod 添加 A 记录到 VPS
2. 群晖 frpc.toml 增加一个 proxy
3. VPS Nginx 增加一个 server
4. 如果是一级子域名，通配符证书已覆盖，不需要重新申请证书
```

本次 `download` 和 `audio` 可以按下面对应关系复用：

```text
download.dailecheng.xyz
  群晖 localPort：8100
  VPS remotePort：18100
  Nginx proxy_pass：http://127.0.0.1:18100

audio.dailecheng.xyz
  群晖 localPort：8800
  VPS remotePort：18800
  Nginx proxy_pass：http://127.0.0.1:18800
```
