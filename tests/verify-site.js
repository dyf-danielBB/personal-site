const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertFile(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`缺少文件：${relativePath}`);
  }
  return read(relativePath);
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label} 缺少内容：${expected}`);
  }
}

function assertNotIncludes(content, unexpected, label) {
  if (content.includes(unexpected)) {
    throw new Error(`${label} 不应再包含内容：${unexpected}`);
  }
}

const html = assertFile("site/index.html");
assertIncludes(html, "<title>光影集 | 个人照片墙</title>", "首页");
assertIncludes(html, 'href="./styles.css"', "首页");
assertIncludes(html, "光影集", "首页");
assertIncludes(html, "Photo Wall", "首页");
assertIncludes(html, "照片墙", "首页");
assertIncludes(html, "精彩瞬间", "首页");

const css = assertFile("site/styles.css");
assertIncludes(css, ":root", "样式");
assertIncludes(css, "@media", "样式");
assertIncludes(css, "prefers-reduced-motion", "样式");

const compose = assertFile("docker-compose.yml");
assertIncludes(compose, "personal-site-nginx", "Compose");
assertIncludes(compose, "nginx:1.27-alpine", "Compose");
assertIncludes(compose, "./site:/usr/share/nginx/html:ro", "Compose");
assertNotIncludes(compose, "personal-site-cloudflared", "Compose");
assertNotIncludes(compose, "cloudflare/cloudflared", "Compose");
assertNotIncludes(compose, "TUNNEL_TOKEN", "Compose");

const readme = assertFile("README.md");
assertIncludes(readme, "群晖个人信息网站", "README");
assertIncludes(readme, "Container Manager", "README");
assertIncludes(readme, "VPS + frp", "README");
assertIncludes(readme, "me.example.com", "README");
assertIncludes(readme, "127.0.0.1:18080", "README");
assertIncludes(readme, "http://群晖局域网IP:8080", "README");
assertIncludes(readme, "手机蜂窝网络", "README");
assertNotIncludes(readme, "personal-site-cloudflared", "README");
assertNotIncludes(readme, "TUNNEL_TOKEN", "README");

console.log("本地结构验收通过：静态站、容器配置和部署说明均已就绪。");
