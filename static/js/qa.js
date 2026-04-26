/* ========== 知识问答页面 ========== */

let searchType = 'both';

// 设置搜索类型
function setSearchType(type) {
    searchType = type;
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
}

// 快捷提问
function askQuick(question) {
    document.getElementById('qa-input').value = question;
    sendQuestion();
}

// 键盘事件
function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuestion();
    }
}

// 自动调整输入框高度
function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// 发送问题
async function sendQuestion() {
    const input = document.getElementById('qa-input');
    const question = input.value.trim();
    if (!question) return;

    // 隐藏欢迎消息
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.style.display = 'none';

    // 添加用户消息
    addChatMessage('user', question);
    input.value = '';
    input.style.height = 'auto';

    // 显示加载
    const loadingId = addLoadingMessage();

    // 禁用发送按钮
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;

    try {
        const data = await api('/api/qa/ask', {
            method: 'POST',
            body: JSON.stringify({ question, search_type: searchType })
        });

        // 移除加载
        removeLoadingMessage(loadingId);

        // 渲染回答
        let answerHtml = renderMarkdown(data.answer || '暂无回答');

        // 添加来源引用
        if (data.sources && data.sources.length > 0) {
            answerHtml += '<div class="source-list"><strong>📚 参考文档：</strong>';
            data.sources.forEach(s => {
                answerHtml += `<div class="source-item" onclick="window.location.href='/?keyword=${encodeURIComponent(s.title)}'">
                    <div class="source-title">${escapeHtml(s.title)}</div>
                    <div class="source-cat">${s.category || '未分类'} · ${formatTime(s.updated_at)}</div>
                </div>`;
            });
            answerHtml += '</div>';
        }

        addChatMessage('assistant', answerHtml, true);
    } catch (e) {
        removeLoadingMessage(loadingId);
        addChatMessage('assistant', `❌ 请求失败：${e.message}`);
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

// 添加聊天消息
function addChatMessage(role, content, isHtml = false) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;

    const avatarIcon = role === 'user' ? 'fa-user' : 'fa-robot';
    const textContent = isHtml ? content : escapeHtml(content);

    msg.innerHTML = `
        <div class="chat-avatar"><i class="fas ${avatarIcon}"></i></div>
        <div class="chat-bubble">${textContent}</div>
    `;

    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
}

// 添加加载动画
function addLoadingMessage() {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-msg assistant';
    msg.id = 'loading-msg';
    msg.innerHTML = `
        <div class="chat-avatar"><i class="fas fa-robot"></i></div>
        <div class="chat-bubble">
            <div class="typing-indicator"><span></span><span></span><span></span></div>
        </div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return 'loading-msg';
}

// 移除加载动画
function removeLoadingMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
