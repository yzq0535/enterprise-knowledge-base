/* ========== 通用工具函数 ========== */

// Toast 通知
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// API 请求封装
async function api(url, options = {}) {
    try {
        const resp = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || '请求失败');
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}

// 防抖
function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// 侧边栏切换
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// 加载统计数据
async function loadStats() {
    try {
        const stats = await api('/api/stats');
        const docsEl = document.getElementById('stat-docs');
        if (docsEl) docsEl.textContent = stats.total_docs;

        const totalDocsEl = document.getElementById('total-docs');
        if (totalDocsEl) totalDocsEl.textContent = stats.total_docs;

        const totalCatEl = document.getElementById('total-categories');
        if (totalCatEl) totalCatEl.textContent = stats.total_categories;

        const totalQaEl = document.getElementById('total-qa');
        if (totalQaEl) totalQaEl.textContent = stats.total_qa;
    } catch (e) {}
}

// 页面加载时获取统计
document.addEventListener('DOMContentLoaded', loadStats);

// Markdown 渲染
function renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
        return marked.parse(text);
    }
    return text.replace(/\n/g, '<br>');
}

// 时间格式化
function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
    return dateStr.substring(0, 10);
}

// 导出数据
async function exportData() {
    try {
        const data = await api('/api/export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `knowledge-base-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('数据导出成功', 'success');
    } catch (e) {}
}

// 导入数据
async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = await api('/api/import', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        showToast(result.message, 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (e) {}
    event.target.value = '';
}
