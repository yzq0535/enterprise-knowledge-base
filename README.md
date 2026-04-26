# 🏢 企业知识库管理系统

基于 Python Flask 的企业级知识管理平台，支持知识文档管理、AI 内容校验、审核工作流和智能问答。

## ✨ 功能特性

- **🔐 用户认证**：账号密码登录，三种角色（管理员/编辑者/访客）
- **📝 知识文档**：增删改查、分类管理、标签系统、全文搜索
- **🤖 AI 内容校验**：自动检查 Linux 命令、配置文件、操作步骤的准确性
- **📋 审核工作流**：用户提交 → AI 校验 → 管理员审核 → 发布
- **🔔 通知系统**：实时通知管理员和作者审核进度
- **💬 智能问答**：关键词搜索 + AI 问答双模式
- **💾 数据管理**：JSON 格式导入导出

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install flask requests
```

### 2. 启动服务

```bash
python3 app.py
```

### 3. 访问系统

打开浏览器访问：http://127.0.0.1:5000

- **默认管理员**：admin / admin123

## 📁 项目结构

```
knowledge-base/
├── app.py                 # Flask 后端主程序
├── start.sh               # 一键启动脚本
├── requirements.txt       # Python 依赖
├── knowledge.db           # SQLite 数据库（自动创建）
├── templates/             # HTML 模板
│   ├── base.html          # 基础布局
│   ├── login.html         # 登录页
│   ├── register.html      # 注册页
│   ├── index.html         # 知识文档页
│   ├── qa.html            # 知识问答页
│   ├── review.html        # 审核管理页
│   ├── admin.html         # 用户管理页
│   ├── my.html            # 我的文档页
│   └── settings.html      # 系统设置页
└── static/
    ├── css/style.css      # 全局样式
    └── js/
        ├── common.js      # 通用工具
        ├── documents.js   # 文档管理
        ├── qa.js          # 问答功能
        └── settings.js    # 设置页面
```

## 🔧 AI 配置

进入「系统设置」页面，填入 API Key 即可启用 AI 功能。

支持兼容 OpenAI 格式的 API：
- OpenAI (GPT-3.5/GPT-4)
- DeepSeek
- 通义千问
- 其他兼容接口

## 👥 角色权限

| 角色 | 权限 |
|------|------|
| **管理员** | 全部功能：文档管理、审核发布、用户管理、系统设置 |
| **编辑者** | 上传文档、查看自己的文档、知识问答 |
| **访客** | 浏览已发布的文档、知识问答 |

## 📋 审核流程

```
用户提交文档 → AI 自动校验 → 管理员审核 → 发布到知识库
                  ↓                    ↓
            校验未通过              驳回
                  ↓                    ↓
         通知管理员+作者          通知作者修改
                                       ↓
                                  修改后重新提交
```

## 🛠️ 技术栈

- **后端**：Python 3.8+ / Flask
- **数据库**：SQLite
- **前端**：HTML + CSS + JavaScript（原生）
- **AI**：OpenAI 兼容 API

## 📄 License

MIT
