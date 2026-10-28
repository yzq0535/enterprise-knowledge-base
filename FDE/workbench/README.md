# 工作台账（手机 H5）

单用户日常台账系统：卫生打卡（服务端水印）、图书资料出入库、图书借阅、周报自动汇总与长图导出。

- 手机浏览器访问，可「添加到主屏幕」当 App 用
- 数据存放在你自己的服务器（SQLite 文件），不经过第三方
- 时间、水印全部以服务器为准，改手机时间无效

## 一、目录结构

```
workbench/
├─ server.js              后端入口（Express 接口 + 静态托管）
├─ src/
│  ├─ db.js               SQLite 数据层（Node 内置 node:sqlite）
│  ├─ auth.js             scrypt 密码 + HMAC 签名 Cookie
│  ├─ time.js             统一 Asia/Shanghai 时间工具
│  ├─ photo.js            sharp 压缩 + 时间水印
│  └─ report.js           周报统计（周一至周日）
├─ public/                前端页面（H5）
│  ├─ index.html
│  ├─ app.js
│  ├─ styles.css
│  ├─ vendor/html2canvas.min.js
│  └─ assets/
├─ deploy/
│  ├─ nginx.conf          Nginx 反向代理 + HTTPS
│  └─ workbench.service   systemd 服务
├─ data/                  运行后自动生成（数据库 + uploads 照片）
└─ package.json
```

## 二、先在本机跑起来（Windows）

1. 安装 Node.js 22.5 或更高版本（`node -v` 确认；内置 `node:sqlite` 必须 ≥22.5）。
2. 进入本目录，安装依赖：

```bash
npm install
```

3. 启动：

```bash
npm start
```

4. 浏览器打开 http://localhost:3000 ，默认密码 `123456`，登录后到「设置 → 修改密码」改成自己的密码。
5. 手机试用：手机与电脑连同一个 WiFi，用电脑内网 IP 访问，例如 `http://192.168.1.10:3000`。
   （电脑防火墙需放行 3000 端口）

> 想先看演示数据：先停掉服务，执行 `node server.js --demo` 再启动即可（仅当库里没有图书时生效）。

## 三、部署到腾讯云服务器（Linux）

以下以 Ubuntu/Debian 为例，应用目录 `/opt/workbench`，数据目录 `/var/lib/workbench`。

### 1. 安装 Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs zip
node -v   # 需 ≥ v22.5
```

### 2. 上传代码并安装依赖

把本目录（不含 `data/`）上传到服务器，例如：

```bash
sudo mkdir -p /opt/workbench
# 用 scp / 宝塔面板 / Git 任意方式把文件放到 /opt/workbench
cd /opt/workbench
sudo npm install --omit=dev
```

`sharp` 会自动下载对应平台的预编译包，不需要额外编译。

### 3. 创建运行用户和数据目录

```bash
sudo useradd -r -s /usr/sbin/nologin workbench || true
sudo mkdir -p /var/lib/workbench/uploads
sudo chown -R workbench:workbench /var/lib/workbench /opt/workbench
```

### 4. 配置 systemd

```bash
sudo cp deploy/workbench.service /etc/systemd/system/workbench.service
sudo systemctl daemon-reload
sudo systemctl enable --now workbench
sudo systemctl status workbench
```

首次启动会用默认密码 `123456` 建库；如需直接指定初始密码，先编辑 service 文件取消 `INIT_PASSWORD` 注释。
**注意：`INIT_PASSWORD` 只在首次建库时生效，之后请在 App 设置里改密码。**

### 5. 配置 Nginx + HTTPS

```bash
sudo apt install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/conf.d/workbench.conf
sudo vim /etc/nginx/conf.d/workbench.conf   # 把 example.com 改成你的域名
sudo nginx -t && sudo systemctl reload nginx
```

申请免费证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

> 国内服务器使用域名 + HTTPS 需要先完成 **ICP 备案**，未备案域名 80/443 会被拦截。
> 备案下来前可先用 `http://服务器公网IP:3000` + 安全组放行 3000 端口临时访问。

### 6. 安全组 / 防火墙

腾讯云控制台安全组放行 80、443（临时访问再放行 3000），服务器上：

```bash
sudo ufw allow 'Nginx Full'   # 如启用了 ufw
```

## 四、手机使用

1. 手机浏览器打开 `https://your-domain.com`
2. iPhone：Safari → 分享 → 「添加到主屏幕」；Android：Chrome → 菜单 → 「添加到主屏幕」
3. 之后从桌面图标打开，全屏无地址栏

## 五、数据备份与恢复

- App「设置 → 数据备份」会下载一个 ZIP（含 `workbench.db` 和 `uploads/` 照片）。
- 恢复：把 ZIP 解压到 `DATA_DIR`（默认 `/var/lib/workbench`），重启服务即可。
- 建议每周备份一次并另存一份到电脑/网盘。
- 备份接口依赖服务器的 `zip` 命令：`sudo apt install -y zip`。

## 六、常用运维命令

```bash
sudo systemctl restart workbench    # 重启
sudo journalctl -u workbench -f     # 看日志
sudo systemctl stop workbench       # 停止
```

## 七、常见问题

**启动报 `Cannot find module 'node:sqlite'`**
Node 版本低于 22.5，升级 Node 即可。

**拍照上传失败 / 请求体过大**
Nginx `client_max_body_size` 需 ≥ 20m（本项目配置已设置）。

**时间显示不对**
服务器时区无需调整，程序内部固定按 `Asia/Shanghai` 计算；请确认服务器系统时间已同步（`timedatectl`）。

**忘记密码怎么办**
服务器上删除或改名 `data/workbench.db` 会清空全部数据（包括台账），不推荐。更稳妥的做法是在服务器上用 Node 直接重置：

```bash
cd /opt/workbench
node -e "const a=require('./src/auth');const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/var/lib/workbench/workbench.db');const {salt,hash}=a.hashPassword('新密码123');db.prepare('UPDATE users SET salt=?,hash=? WHERE username=?').run(salt,hash,'admin');console.log('ok')"
```

然后重启服务。
