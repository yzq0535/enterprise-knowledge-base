/* ========== 设置页面 ========== */

document.addEventListener('DOMContentLoaded', loadSettings);

// 加载设置
async function loadSettings() {
    try {
        const settings = await api('/api/settings');
        document.getElementById('api-key').value = settings.api_key || '';
        document.getElementById('base-url').value = settings.base_url || '';
        document.getElementById('model-name').value = settings.model || 'gpt-3.5-turbo';

        const badge = document.getElementById('ai-status-badge');
        if (settings.has_key) {
            badge.textContent = '已配置';
            badge.className = 'badge badge-success';
        } else {
            badge.textContent = '未配置';
            badge.className = 'badge badge-warning';
        }
    } catch (e) {}
}

// API 类型切换
function onApiTypeChange() {
    const type = document.getElementById('api-type').value;
    const baseGroup = document.getElementById('base-url-group');
    baseGroup.style.display = type === 'custom' ? 'block' : 'none';
}

// 密码可见性切换
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// 保存设置
async function saveSettings() {
    const apiKey = document.getElementById('api-key').value.trim();
    const baseUrl = document.getElementById('base-url').value.trim();
    const model = document.getElementById('model-name').value.trim();

    try {
        await api('/api/settings', {
            method: 'POST',
            body: JSON.stringify({
                api_key: apiKey,
                base_url: baseUrl,
                model: model || 'gpt-3.5-turbo'
            })
        });
        showToast('设置保存成功', 'success');
        loadSettings();
    } catch (e) {}
}

// 测试连接
async function testConnection() {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) {
        showToast('请先输入 API Key', 'error');
        return;
    }

    showToast('正在测试连接...', 'info');

    try {
        const baseUrl = document.getElementById('base-url').value.trim();
        const model = document.getElementById('model-name').value.trim() || 'gpt-3.5-turbo';

        const api_url = baseUrl
            ? `${baseUrl}/v1/chat/completions`
            : 'https://api.openai.com/v1/chat/completions';

        const resp = await fetch('/api/qa/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: '你好，请回复"连接成功"',
                search_type: 'ai'
            })
        });

        const data = await resp.json();
        if (data.answer && !data.answer.includes('❌')) {
            showToast('AI 接口连接成功！', 'success');
        } else {
            showToast('连接失败：' + (data.answer || '未知错误'), 'error');
        }
    } catch (e) {
        showToast('连接测试失败：' + e.message, 'error');
    }
}

// 清空问答历史
async function clearHistory() {
    if (!confirm('确定要清空所有问答历史记录吗？')) return;
    try {
        await api('/api/qa/history', { method: 'DELETE' });
        showToast('历史记录已清空', 'success');
    } catch (e) {}
}
