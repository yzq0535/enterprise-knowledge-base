"""
企业知识库 - Flask 后端应用
支持：用户认证、角色权限、内容审核工作流、AI内容校验、知识问答
"""

import os
import sqlite3
import json
import hashlib
import secrets
import requests
from datetime import datetime
from functools import wraps
from flask import (Flask, render_template, request, jsonify, g,
                   redirect, url_for, session)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'enterprise-kb-secret-' + secrets.token_hex(16)
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'knowledge.db')

# ========== AI 配置 ==========
AI_CONFIG = {
    'api_key': '',
    'api_url': 'https://api.openai.com/v1/chat/completions',
    'model': 'gpt-3.5-turbo',
    'base_url': '',
}

# 默认管理员密码
DEFAULT_ADMIN = {'username': 'admin', 'password': 'admin123'}


# ========== 数据库工具 ==========

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """初始化数据库表"""
    db = sqlite3.connect(DATABASE)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")

    # 用户表
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT DEFAULT '',
            role TEXT DEFAULT 'viewer' CHECK(role IN ('admin','user','viewer')),
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    """)

    # 文档表（增加审核状态）
    db.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT DEFAULT '未分类',
            content TEXT NOT NULL,
            tags TEXT DEFAULT '',
            solution TEXT DEFAULT '',
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending','ai_checking','ai_rejected','reviewing','published','rejected')),
            author_id INTEGER,
            reviewer_id INTEGER,
            ai_review TEXT DEFAULT '',
            ai_review_passed INTEGER DEFAULT 0,
            review_note TEXT DEFAULT '',
            published_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (author_id) REFERENCES users(id),
            FOREIGN KEY (reviewer_id) REFERENCES users(id)
        )
    """)

    # 通知表
    db.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            related_id INTEGER DEFAULT 0,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # 分类表
    db.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            color TEXT DEFAULT '#6366f1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 问答历史
    db.execute("""
        CREATE TABLE IF NOT EXISTS qa_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            source_doc_ids TEXT DEFAULT '',
            search_type TEXT DEFAULT 'keyword',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # 默认分类
    default_categories = [
        ('网络问题', '#ef4444'), ('服务器运维', '#f97316'),
        ('数据库', '#eab308'), ('中间件', '#22c55e'),
        ('脚本工具', '#3b82f6'), ('安全相关', '#8b5cf6'), ('其他', '#6b7280'),
    ]
    for name, color in default_categories:
        db.execute("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)", (name, color))

    # 默认管理员
    pw_hash = hash_password(DEFAULT_ADMIN['password'])
    db.execute(
        "INSERT OR IGNORE INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
        (DEFAULT_ADMIN['username'], pw_hash, '系统管理员', 'admin')
    )

    db.commit()
    db.close()


# ========== 密码工具 ==========

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


# ========== 认证装饰器 ==========

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '请先登录', 'code': 'login_required'}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '请先登录', 'code': 'login_required'}), 401
        if session.get('role') != 'admin':
            return jsonify({'error': '需要管理员权限'}), 403
        return f(*args, **kwargs)
    return decorated


def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': '请先登录', 'code': 'login_required'}), 401
            if session.get('role') not in roles:
                return jsonify({'error': '权限不足'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


def get_current_user():
    """获取当前登录用户信息"""
    if 'user_id' not in session:
        return None
    return {
        'id': session['user_id'],
        'username': session['username'],
        'display_name': session.get('display_name', ''),
        'role': session['role']
    }


# ========== 页面路由 ==========

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('index.html')


@app.route('/login')
def login_page():
    return render_template('login.html')


@app.route('/register')
def register_page():
    return render_template('register.html')


@app.route('/qa')
def qa_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('qa.html')


@app.route('/review')
def review_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('review.html')


@app.route('/admin')
def admin_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('admin.html')


@app.route('/settings')
def settings_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('settings.html')


@app.route('/my')
def my_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('my.html')


# ========== 认证 API ==========

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ? AND is_active = 1", (username,)).fetchone()

    if not user or user['password_hash'] != hash_password(password):
        return jsonify({'error': '用户名或密码错误'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    session['display_name'] = user['display_name'] or user['username']
    session['role'] = user['role']

    # 更新最后登录时间
    db.execute("UPDATE users SET last_login = ? WHERE id = ?",
               (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user['id']))
    db.commit()

    return jsonify({
        'user': {
            'id': user['id'],
            'username': user['username'],
            'display_name': user['display_name'] or user['username'],
            'role': user['role']
        }
    })


@app.route('/api/auth/register', methods=['POST'])
def api_register():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    display_name = data.get('display_name', '').strip()

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    if len(username) < 3:
        return jsonify({'error': '用户名至少3个字符'}), 400
    if len(password) < 6:
        return jsonify({'error': '密码至少6个字符'}), 400

    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
            (username, hash_password(password), display_name or username, 'viewer')
        )
        db.commit()
        return jsonify({'message': '注册成功，请联系管理员开通上传权限'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': '用户名已存在'}), 400


@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'message': '已退出登录'})


@app.route('/api/auth/current', methods=['GET'])
def api_current_user():
    user = get_current_user()
    if user:
        return jsonify({'user': user})
    return jsonify({'user': None})


@app.route('/api/auth/change-password', methods=['POST'])
@login_required
def api_change_password():
    data = request.get_json()
    old_pwd = data.get('old_password', '')
    new_pwd = data.get('new_password', '')

    if not old_pwd or not new_pwd:
        return jsonify({'error': '请输入旧密码和新密码'}), 400
    if len(new_pwd) < 6:
        return jsonify({'error': '新密码至少6个字符'}), 400

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],)).fetchone()
    if not user or user['password_hash'] != hash_password(old_pwd):
        return jsonify({'error': '旧密码错误'}), 400

    db.execute("UPDATE users SET password_hash = ? WHERE id = ?",
               (hash_password(new_pwd), session['user_id']))
    db.commit()
    return jsonify({'message': '密码修改成功'})


# ========== 文档 API（带审核工作流）==========

@app.route('/api/documents', methods=['GET'])
@login_required
def get_documents():
    """获取文档列表（普通用户和访客只看已发布的）"""
    db = get_db()
    user_role = session['role']
    user_id = session['user_id']

    keyword = request.args.get('keyword', '').strip()
    category = request.args.get('category', '').strip()
    status = request.args.get('status', '').strip()
    author_id = request.args.get('author_id', '').strip()
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))

    conditions = []
    params = []

    # 权限控制：非管理员/非作者只能看已发布的
    if user_role == 'viewer':
        conditions.append("d.status = 'published'")
    elif user_role == 'user':
        # 普通用户看已发布的 + 自己提交的
        conditions.append("(d.status = 'published' OR d.author_id = ?)")
        params.append(user_id)
    # admin 可以看所有

    if keyword:
        conditions.append("(d.title LIKE ? OR d.content LIKE ? OR d.solution LIKE ? OR d.tags LIKE ?)")
        kw = f'%{keyword}%'
        params.extend([kw, kw, kw, kw])
    if category:
        conditions.append("d.category = ?")
        params.append(category)
    if status:
        conditions.append("d.status = ?")
        params.append(status)
    if author_id:
        conditions.append("d.author_id = ?")
        params.append(int(author_id))

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    count_sql = f"SELECT COUNT(*) FROM documents d {where}"
    total = db.execute(count_sql, params).fetchone()[0]

    offset = (page - 1) * per_page
    sql = f"""
        SELECT d.*, c.color as category_color,
               a.username as author_name, a.display_name as author_display_name,
               r.username as reviewer_name
        FROM documents d
        LEFT JOIN categories c ON d.category = c.name
        LEFT JOIN users a ON d.author_id = a.id
        LEFT JOIN users r ON d.reviewer_id = r.id
        {where}
        ORDER BY d.updated_at DESC
        LIMIT ? OFFSET ?
    """
    rows = db.execute(sql, params + [per_page, offset]).fetchall()
    documents = [dict(row) for row in rows]

    return jsonify({
        'documents': documents,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })


@app.route('/api/documents/<int:doc_id>', methods=['GET'])
@login_required
def get_document(doc_id):
    db = get_db()
    row = db.execute("""
        SELECT d.*, c.color as category_color,
               a.username as author_name, a.display_name as author_display_name,
               r.username as reviewer_name
        FROM documents d
        LEFT JOIN categories c ON d.category = c.name
        LEFT JOIN users a ON d.author_id = a.id
        LEFT JOIN users r ON d.reviewer_id = r.id
        WHERE d.id = ?
    """, (doc_id,)).fetchone()
    if row:
        return jsonify(dict(row))
    return jsonify({'error': '文档不存在'}), 404


@app.route('/api/documents', methods=['POST'])
@role_required('admin', 'user')
def create_document():
    """创建文档 → 自动进入AI校验流程"""
    data = request.get_json()
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': '标题不能为空'}), 400

    db = get_db()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor = db.execute(
        """INSERT INTO documents (title, category, content, tags, solution, status, author_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'ai_checking', ?, ?, ?)""",
        (
            title,
            data.get('category', '未分类').strip(),
            data.get('content', '').strip(),
            data.get('tags', '').strip(),
            data.get('solution', '').strip(),
            session['user_id'], now, now
        )
    )
    db.commit()
    doc_id = cursor.lastrowid

    # 异步调用AI校验（同步执行，因为Flask不支持真正的异步）
    ai_result = ai_review_content(doc_id, title, data.get('content', ''),
                                   data.get('solution', ''), data.get('category', ''))

    return jsonify({
        'id': doc_id,
        'message': '文档已提交，正在进行AI校验...',
        'ai_review': ai_result
    }), 201


@app.route('/api/documents/<int:doc_id>', methods=['PUT'])
@login_required
def update_document(doc_id):
    data = request.get_json()
    db = get_db()
    doc = db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not doc:
        return jsonify({'error': '文档不存在'}), 404

    # 只有作者或管理员可以编辑
    if doc['author_id'] != session['user_id'] and session['role'] != 'admin':
        return jsonify({'error': '无权编辑此文档'}), 403

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    db.execute(
        """UPDATE documents SET title=?, category=?, content=?, tags=?, solution=?, updated_at=?
           WHERE id=?""",
        (
            data.get('title', '').strip(),
            data.get('category', '未分类').strip(),
            data.get('content', '').strip(),
            data.get('tags', '').strip(),
            data.get('solution', '').strip(),
            now, doc_id
        )
    )
    db.commit()
    return jsonify({'message': '文档更新成功'})


@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
@login_required
def delete_document(doc_id):
    db = get_db()
    doc = db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not doc:
        return jsonify({'error': '文档不存在'}), 404
    if doc['author_id'] != session['user_id'] and session['role'] != 'admin':
        return jsonify({'error': '无权删除此文档'}), 403

    db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    db.commit()
    return jsonify({'message': '文档删除成功'})


# ========== AI 内容校验 ==========

def ai_review_content(doc_id, title, content, solution, category):
    """调用AI校验文档内容的准确性"""
    api_key = AI_CONFIG.get('api_key', '')
    db = get_db()

    if not api_key:
        # 没有配置AI，直接通过校验，进入人工审核
        db.execute("""
            UPDATE documents SET status = 'reviewing', ai_review_passed = 1,
            ai_review = 'AI校验未配置，跳过自动校验，进入人工审核。'
            WHERE id = ?
        """, (doc_id,))
        db.commit()
        notify_admin(doc_id, title, '新文档待审核', f'文档「{title}」已提交，AI校验未配置，请人工审核。')
        return {'passed': True, 'message': 'AI校验未配置，已进入人工审核'}

    system_prompt = """你是一个专业的IT运维知识审核专家。请仔细检查以下知识文档的内容是否准确。

重点检查：
1. **Linux命令**：命令语法是否正确、参数是否有效、是否存在危险操作
2. **配置文件**：配置语法是否正确、路径是否合理
3. **操作步骤**：步骤是否完整、顺序是否正确、是否有遗漏
4. **技术概念**：技术描述是否准确、是否有误导性内容
5. **安全性**：是否包含不安全的操作（如危险的rm命令、开放端口等）

请严格按以下JSON格式返回（不要包含其他内容）：
{
    "passed": true或false,
    "score": 1-100的分数,
    "issues": ["发现的问题1", "发现的问题2"],
    "suggestions": ["改进建议1", "改进建议2"],
    "summary": "总体评价"
}

注意：
- 如果只是小问题（如格式、措辞），passed设为true
- 如果存在严重的技术错误或危险操作，passed必须设为false
- score根据内容质量打分，80分以上为合格"""

    user_content = f"""【文档标题】{title}
【分类】{category}
【问题描述】
{content}

【解决方案】
{solution}"""

    try:
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        payload = {
            'model': AI_CONFIG.get('model', 'gpt-3.5-turbo'),
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_content}
            ],
            'temperature': 0.3,
            'max_tokens': 2000
        }
        base_url = AI_CONFIG.get('base_url', '').rstrip('/')
        api_url = base_url + '/v1/chat/completions' if base_url else AI_CONFIG['api_url']

        resp = requests.post(api_url, headers=headers, json=payload, timeout=60)
        if resp.status_code == 200:
            result = resp.json()
            ai_text = result['choices'][0]['message']['content'].strip()
            # 解析AI返回的JSON
            try:
                # 提取JSON部分
                json_str = ai_text
                if '```json' in ai_text:
                    json_str = ai_text.split('```json')[1].split('```')[0].strip()
                elif '```' in ai_text:
                    json_str = ai_text.split('```')[1].split('```')[0].strip()

                review = json.loads(json_str)
                passed = review.get('passed', True)
                score = review.get('score', 0)
                issues = review.get('issues', [])
                suggestions = review.get('suggestions', [])
                summary = review.get('summary', '')

                review_text = f"**评分：{score}/100**\n**结果：{'✅ 通过' if passed else '❌ 未通过'}**\n\n"
                if summary:
                    review_text += f"**总体评价：** {summary}\n\n"
                if issues:
                    review_text += "**发现的问题：**\n"
                    for i, issue in enumerate(issues, 1):
                        review_text += f"{i}. {issue}\n"
                if suggestions:
                    review_text += "\n**改进建议：**\n"
                    for i, sug in enumerate(suggestions, 1):
                        review_text += f"{i}. {sug}\n"

                if passed:
                    # AI校验通过 → 进入管理员审核
                    new_status = 'reviewing'
                    notify_msg = f'文档「{title}」AI校验通过（{score}分），请审核发布。'
                else:
                    # AI校验未通过 → 通知管理员和作者
                    new_status = 'ai_rejected'
                    notify_msg = f'文档「{title}」AI校验未通过（{score}分），发现{len(issues)}个问题，请处理。'

                db.execute("""
                    UPDATE documents SET status = ?, ai_review_passed = ?, ai_review = ?, updated_at = ?
                    WHERE id = ?
                """, (new_status, 1 if passed else 0, review_text,
                      datetime.now().strftime('%Y-%m-%d %H:%M:%S'), doc_id))
                db.commit()

                # 通知管理员
                notify_admin(doc_id, title, 'AI校验完成', notify_msg)

                # 如果未通过，也通知作者
                if not passed:
                    doc = db.execute("SELECT author_id FROM documents WHERE id = ?", (doc_id,)).fetchone()
                    if doc and doc['author_id']:
                        create_notification(doc['author_id'], 'ai_rejected',
                                            f'您的文档「{title}」AI校验未通过',
                                            f'AI发现{len(issues)}个问题，请修改后重新提交。\n\n{review_text}',
                                            doc_id)

                return {'passed': passed, 'score': score, 'review': review_text}
            except json.JSONDecodeError:
                # JSON解析失败，视为通过
                db.execute("""
                    UPDATE documents SET status = 'reviewing', ai_review_passed = 1,
                    ai_review = ?, updated_at = ?
                    WHERE id = ?
                """, (ai_text, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), doc_id))
                db.commit()
                notify_admin(doc_id, title, '新文档待审核', f'文档「{title}」AI校验完成，请审核。')
                return {'passed': True, 'message': ai_text}
        else:
            raise Exception(f"HTTP {resp.status_code}")
    except Exception as e:
        # AI调用失败，进入人工审核
        error_msg = f"AI校验调用失败: {str(e)}"
        db.execute("""
            UPDATE documents SET status = 'reviewing', ai_review_passed = 1,
            ai_review = ?, updated_at = ?
            WHERE id = ?
        """, (error_msg, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), doc_id))
        db.commit()
        notify_admin(doc_id, title, '新文档待审核', f'文档「{title}」AI校验异常，请人工审核。')
        return {'passed': True, 'message': error_msg}


# ========== 审核工作流 API ==========

@app.route('/api/review/list', methods=['GET'])
@admin_required
def get_review_list():
    """获取待审核文档列表"""
    db = get_db()
    status = request.args.get('status', 'reviewing')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    offset = (page - 1) * per_page

    count = db.execute("SELECT COUNT(*) FROM documents WHERE status IN ('reviewing','ai_rejected')").fetchone()[0]
    rows = db.execute("""
        SELECT d.*, c.color as category_color,
               a.username as author_name, a.display_name as author_display_name
        FROM documents d
        LEFT JOIN categories c ON d.category = c.name
        LEFT JOIN users a ON d.author_id = a.id
        WHERE d.status IN ('reviewing','ai_rejected')
        ORDER BY d.updated_at DESC
        LIMIT ? OFFSET ?
    """, (per_page, offset)).fetchall()

    return jsonify({
        'documents': [dict(row) for row in rows],
        'total': count,
        'page': page,
        'total_pages': (count + per_page - 1) // per_page
    })


@app.route('/api/review/<int:doc_id>/approve', methods=['POST'])
@admin_required
def approve_document(doc_id):
    """管理员审核通过并发布"""
    db = get_db()
    doc = db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not doc:
        return jsonify({'error': '文档不存在'}), 404

    data = request.get_json() or {}
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # 管理员可以编辑内容后发布
    if data.get('title'):
        db.execute("UPDATE documents SET title = ?, category = ?, content = ?, tags = ?, solution = ? WHERE id = ?",
                    (data.get('title', '').strip(), data.get('category', doc['category']).strip(),
                     data.get('content', '').strip(), data.get('tags', '').strip(),
                     data.get('solution', '').strip(), doc_id))

    db.execute("""
        UPDATE documents SET status = 'published', reviewer_id = ?, review_note = ?,
        published_at = ?, updated_at = ? WHERE id = ?
    """, (session['user_id'], data.get('note', '审核通过'), now, now, doc_id))
    db.commit()

    # 通知作者
    if doc['author_id']:
        create_notification(doc['author_id'], 'approved',
                            f'您的文档「{doc["title"]}」已审核通过并发布',
                            '您的知识文档已通过管理员审核，现已发布到知识库。', doc_id)

    return jsonify({'message': '文档已发布'})


@app.route('/api/review/<int:doc_id>/reject', methods=['POST'])
@admin_required
def reject_document(doc_id):
    """管理员驳回文档"""
    db = get_db()
    doc = db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not doc:
        return jsonify({'error': '文档不存在'}), 404

    data = request.get_json() or {}
    note = data.get('note', '未通过审核')

    db.execute("""
        UPDATE documents SET status = 'rejected', reviewer_id = ?, review_note = ?, updated_at = ?
        WHERE id = ?
    """, (session['user_id'], note, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), doc_id))
    db.commit()

    # 通知作者
    if doc['author_id']:
        create_notification(doc['author_id'], 'rejected',
                            f'您的文档「{doc["title"]}」被驳回',
                            f'驳回原因：{note}\n\n您可以修改后重新提交。', doc_id)

    return jsonify({'message': '文档已驳回'})


@app.route('/api/documents/<int:doc_id>/resubmit', methods=['POST'])
@login_required
def resubmit_document(doc_id):
    """作者修改后重新提交（回到AI校验）"""
    db = get_db()
    doc = db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not doc:
        return jsonify({'error': '文档不存在'}), 404
    if doc['author_id'] != session['user_id'] and session['role'] != 'admin':
        return jsonify({'error': '无权操作'}), 403

    data = request.get_json() or {}
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # 更新内容
    if data.get('title'):
        db.execute("""UPDATE documents SET title=?, category=?, content=?, tags=?, solution=?,
                      status='ai_checking', ai_review='', ai_review_passed=0, review_note='', updated_at=?
                      WHERE id=?""",
                    (data.get('title', '').strip(), data.get('category', '').strip(),
                     data.get('content', '').strip(), data.get('tags', '').strip(),
                     data.get('solution', '').strip(), now, doc_id))
    else:
        db.execute("UPDATE documents SET status = 'ai_checking', ai_review = '', updated_at = ? WHERE id = ?",
                    (now, doc_id))
    db.commit()

    # 重新AI校验
    ai_review_content(doc_id, data.get('title', doc['title']),
                      data.get('content', doc['content']),
                      data.get('solution', doc['solution']),
                      data.get('category', doc['category']))

    return jsonify({'message': '文档已重新提交AI校验'})


# ========== 通知系统 ==========

def create_notification(user_id, ntype, title, content, related_id=0):
    db = get_db()
    db.execute(
        "INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)",
        (user_id, ntype, title, content, related_id)
    )
    db.commit()


def notify_admin(doc_id, doc_title, title, content):
    """通知所有管理员"""
    db = get_db()
    admins = db.execute("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").fetchall()
    for admin in admins:
        create_notification(admin['id'], 'review_required', title,
                            content, doc_id)


@app.route('/api/notifications', methods=['GET'])
@login_required
def get_notifications():
    db = get_db()
    user_id = session['user_id']
    rows = db.execute(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        (user_id,)
    ).fetchall()

    unread = db.execute(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0",
        (user_id,)
    ).fetchone()[0]

    return jsonify({
        'notifications': [dict(row) for row in rows],
        'unread_count': unread
    })


@app.route('/api/notifications/<int:nid>/read', methods=['POST'])
@login_required
def mark_notification_read(nid):
    db = get_db()
    db.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
               (nid, session['user_id']))
    db.commit()
    return jsonify({'message': 'ok'})


@app.route('/api/notifications/read-all', methods=['POST'])
@login_required
def mark_all_notifications_read():
    db = get_db()
    db.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (session['user_id'],))
    db.commit()
    return jsonify({'message': 'ok'})


# ========== 用户管理 API（管理员）==========

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_users():
    db = get_db()
    rows = db.execute("""
        SELECT id, username, display_name, role, is_active, created_at, last_login
        FROM users ORDER BY created_at DESC
    """).fetchall()
    return jsonify({'users': [dict(row) for row in rows]})


@app.route('/api/admin/users', methods=['POST'])
@admin_required
def create_user():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    role = data.get('role', 'viewer')

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400

    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
            (username, hash_password(password), data.get('display_name', username), role)
        )
        db.commit()
        return jsonify({'message': f'用户 {username} 创建成功'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': '用户名已存在'}), 400


@app.route('/api/admin/users/<int:uid>', methods=['PUT'])
@admin_required
def update_user(uid):
    data = request.get_json()
    db = get_db()

    if data.get('role'):
        db.execute("UPDATE users SET role = ? WHERE id = ?", (data['role'], uid))
    if data.get('display_name') is not None:
        db.execute("UPDATE users SET display_name = ? WHERE id = ?", (data['display_name'].strip(), uid))
    if 'is_active' in data:
        db.execute("UPDATE users SET is_active = ? WHERE id = ?", (int(data['is_active']), uid))
    if data.get('new_password'):
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                    (hash_password(data['new_password']), uid))

    db.commit()
    return jsonify({'message': '用户信息已更新'})


@app.route('/api/admin/users/<int:uid>', methods=['DELETE'])
@admin_required
def delete_user(uid):
    if uid == session['user_id']:
        return jsonify({'error': '不能删除自己'}), 400
    db = get_db()
    db.execute("DELETE FROM users WHERE id = ? AND role != 'admin'", (uid,))
    db.commit()
    return jsonify({'message': '用户已删除'})


# ========== 分类 API ==========

@app.route('/api/categories', methods=['GET'])
@login_required
def get_categories():
    db = get_db()
    rows = db.execute("SELECT * FROM categories ORDER BY name").fetchall()
    return jsonify([dict(row) for row in rows])


@app.route('/api/categories', methods=['POST'])
@admin_required
def create_category():
    data = request.get_json()
    db = get_db()
    try:
        db.execute("INSERT INTO categories (name, color) VALUES (?, ?)",
                    (data.get('name', '').strip(), data.get('color', '#6366f1')))
        db.commit()
        return jsonify({'message': '分类创建成功'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': '分类已存在'}), 400


@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
@admin_required
def delete_category(cat_id):
    db = get_db()
    db.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
    db.commit()
    return jsonify({'message': '分类删除成功'})


# ========== 统计 API ==========

@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    db = get_db()
    user_role = session['role']

    total_published = db.execute("SELECT COUNT(*) FROM documents WHERE status = 'published'").fetchone()[0]
    total_pending = db.execute("SELECT COUNT(*) FROM documents WHERE status IN ('reviewing','ai_checking','ai_rejected')").fetchone()[0]
    total_categories = db.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    total_users = db.execute("SELECT COUNT(*) FROM users WHERE is_active = 1").fetchone()[0]

    stats = {
        'total_published': total_published,
        'total_pending': total_pending,
        'total_categories': total_categories,
        'total_users': total_users,
    }

    if user_role == 'admin':
        stats['total_rejected'] = db.execute("SELECT COUNT(*) FROM documents WHERE status = 'rejected'").fetchone()[0]
        stats['total_qa'] = db.execute("SELECT COUNT(*) FROM qa_history").fetchone()[0]

    return jsonify(stats)


# ========== 搜索 API（只搜索已发布的）==========

@app.route('/api/search', methods=['POST'])
@login_required
def search_documents():
    data = request.get_json()
    query = data.get('query', '').strip()
    if not query:
        return jsonify({'results': [], 'message': '请输入搜索内容'})

    db = get_db()
    keywords = query.split()
    conditions = ["d.status = 'published'"]
    params = []

    for kw in keywords:
        conditions.append("(d.title LIKE ? OR d.content LIKE ? OR d.solution LIKE ? OR d.tags LIKE ?)")
        like = f'%{kw}%'
        params.extend([like, like, like, like])

    where = "WHERE " + " AND ".join(conditions)
    sql = f"""
        SELECT d.*, c.color as category_color,
               CASE WHEN d.title LIKE ? THEN 3
                    WHEN d.solution LIKE ? THEN 2
                    WHEN d.content LIKE ? THEN 1
                    ELSE 0 END as relevance
        FROM documents d
        LEFT JOIN categories c ON d.category = c.name
        {where}
        ORDER BY relevance DESC, d.updated_at DESC
        LIMIT 20
    """
    title_like = f'%{query}%'
    params.extend([title_like, title_like, title_like])
    rows = db.execute(sql, params).fetchall()

    return jsonify({
        'results': [dict(row) for row in rows],
        'count': len(rows),
        'query': query
    })


# ========== AI 问答 API ==========

@app.route('/api/qa/ask', methods=['POST'])
@login_required
def ai_ask():
    data = request.get_json()
    question = data.get('question', '').strip()
    search_type = data.get('search_type', 'both')

    if not question:
        return jsonify({'error': '请输入问题'}), 400

    db = get_db()
    answer = ''
    sources = []
    source_doc_ids = []

    # 1. 关键词搜索（只搜已发布的）
    if search_type in ('keyword', 'both'):
        keywords = question.split()
        conditions = ["d.status = 'published'"]
        params = []
        for kw in keywords:
            conditions.append("(d.title LIKE ? OR d.content LIKE ? OR d.solution LIKE ? OR d.tags LIKE ?)")
            like = f'%{kw}%'
            params.extend([like, like, like, like])

        where = "WHERE " + " AND ".join(conditions)
        sql = f"SELECT * FROM documents d {where} ORDER BY d.updated_at DESC LIMIT 5"
        rows = db.execute(sql, params).fetchall()
        keyword_results = [dict(row) for row in rows]

        if keyword_results:
            sources = keyword_results
            source_doc_ids = [str(r['id']) for r in keyword_results]
            answer_parts = [f"🔍 找到 {len(keyword_results)} 条相关知识文档：\n"]
            for i, doc in enumerate(keyword_results, 1):
                answer_parts.append(f"\n**{i}. {doc['title']}** （{doc['category']}）")
                if doc['solution']:
                    answer_parts.append(f"   💡 解决方案：{doc['solution'][:200]}")
                else:
                    answer_parts.append(f"   📝 内容摘要：{doc['content'][:200]}")
            keyword_answer = "\n".join(answer_parts)
        else:
            keyword_answer = "🔍 未找到相关知识文档。"

    # 2. AI 问答
    ai_answer = ''
    if search_type in ('ai', 'both'):
        api_key = AI_CONFIG.get('api_key', '')
        if not api_key:
            ai_answer = "⚠️ AI 问答未配置 API Key，请在设置页面配置后使用。\n"
        else:
            context = ""
            if sources:
                context = "\n\n以下是从知识库中检索到的相关文档：\n"
                for i, doc in enumerate(sources, 1):
                    context += f"\n【文档{i}】{doc['title']}\n分类：{doc['category']}\n内容：{doc['content']}\n"
                    if doc['solution']:
                        context += f"解决方案：{doc['solution']}\n"

            system_prompt = f"""你是一个专业的IT运维知识助手。请根据用户的问题和提供的知识库内容来回答。
规则：1. 优先使用知识库中的内容 2. 回答简洁专业 3. 命令用代码块 4. 中文回答
{context}"""

            try:
                headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
                payload = {
                    'model': AI_CONFIG.get('model', 'gpt-3.5-turbo'),
                    'messages': [
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': question}
                    ],
                    'temperature': 0.7, 'max_tokens': 2000
                }
                base_url = AI_CONFIG.get('base_url', '').rstrip('/')
                api_url = base_url + '/v1/chat/completions' if base_url else AI_CONFIG['api_url']
                resp = requests.post(api_url, headers=headers, json=payload, timeout=30)
                if resp.status_code == 200:
                    ai_answer = resp.json()['choices'][0]['message']['content']
                else:
                    ai_answer = f"❌ AI 接口调用失败（HTTP {resp.status_code}）"
            except Exception as e:
                ai_answer = f"❌ AI 接口异常：{str(e)}"

    if search_type == 'both':
        if ai_answer and sources:
            answer = f"{keyword_answer}\n\n---\n\n🤖 **AI 智能回答：**\n\n{ai_answer}"
        elif ai_answer:
            answer = f"🤖 **AI 智能回答：**\n\n{ai_answer}"
        else:
            answer = keyword_answer
    elif search_type == 'keyword':
        answer = keyword_answer
    else:
        answer = ai_answer

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    db.execute(
        "INSERT INTO qa_history (user_id, question, answer, source_doc_ids, search_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (session['user_id'], question, answer, ','.join(source_doc_ids), search_type, now)
    )
    db.commit()

    return jsonify({'answer': answer, 'sources': sources, 'search_type': search_type})


# ========== 问答历史 ==========

@app.route('/api/qa/history', methods=['GET'])
@login_required
def get_qa_history():
    db = get_db()
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    offset = (page - 1) * per_page
    total = db.execute("SELECT COUNT(*) FROM qa_history").fetchone()[0]
    rows = db.execute(
        "SELECT * FROM qa_history ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (per_page, offset)
    ).fetchall()
    return jsonify({
        'history': [dict(row) for row in rows],
        'total': total, 'page': page,
        'total_pages': (total + per_page - 1) // per_page
    })


# ========== 设置 API ==========

@app.route('/api/settings', methods=['GET'])
@admin_required
def get_settings():
    return jsonify({
        'api_key': AI_CONFIG.get('api_key', ''),
        'base_url': AI_CONFIG.get('base_url', ''),
        'model': AI_CONFIG.get('model', 'gpt-3.5-turbo'),
        'has_key': bool(AI_CONFIG.get('api_key'))
    })


@app.route('/api/settings', methods=['POST'])
@admin_required
def save_settings():
    global AI_CONFIG
    data = request.get_json()
    AI_CONFIG['api_key'] = data.get('api_key', '')
    AI_CONFIG['base_url'] = data.get('base_url', '').rstrip('/')
    AI_CONFIG['model'] = data.get('model', 'gpt-3.5-turbo')
    return jsonify({'message': '设置已保存'})


# ========== 数据导入导出 ==========

@app.route('/api/export', methods=['GET'])
@admin_required
def export_data():
    db = get_db()
    documents = [dict(row) for row in db.execute("SELECT * FROM documents").fetchall()]
    categories = [dict(row) for row in db.execute("SELECT * FROM categories").fetchall()]
    return jsonify({
        'export_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'documents': documents, 'categories': categories
    })


@app.route('/api/import', methods=['POST'])
@admin_required
def import_data():
    data = request.get_json()
    db = get_db()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    imported = 0
    for doc in data.get('documents', []):
        try:
            db.execute(
                """INSERT INTO documents (title, category, content, tags, solution, status, author_id, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?)""",
                (doc['title'], doc.get('category', '未分类'), doc['content'],
                 doc.get('tags', ''), doc.get('solution', ''),
                 session['user_id'], doc.get('created_at', now), now)
            )
            imported += 1
        except Exception:
            pass
    db.commit()
    return jsonify({'message': f'成功导入 {imported} 条文档'})


# ========== 启动 ==========

if __name__ == '__main__':
    init_db()
    print("=" * 50)
    print("  🏢 企业知识库已启动")
    print("  🌐 访问地址: http://127.0.0.1:5000")
    print("  👤 默认管理员: admin / admin123")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
