/* ========== 文档管理页面 ========== */

let currentPage = 1;
const perPage = 20;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadDocuments();
});

// 加载分类
async function loadCategories() {
    try {
        const cats = await api('/api/categories');
        const filterSelect = document.getElementById('category-filter');
        const docSelect = document.getElementById('doc-category');
        filterSelect.innerHTML = '<option value="">全部分类</option>';
        docSelect.innerHTML = '';
        cats.forEach(c => {
            filterSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            docSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
    } catch (e) {}
}

// 加载文档列表
async function loadDocuments() {
    const keyword = document.getElementById('search-input').value;
    const category = document.getElementById('category-filter').value;

    const params = new URLSearchParams({
        page: currentPage,
        per_page: perPage
    });
    if (keyword) params.set('keyword', keyword);
    if (category) params.set('category', category);

    try {
        const data = await api(`/api/documents?${params}`);
        renderDocList(data.documents);
        renderPagination(data);
        document.getElementById('empty-state').style.display = data.documents.length ? 'none' : 'block';
    } catch (e) {}
}

// 渲染文档列表
function renderDocList(docs) {
    const list = document.getElementById('doc-list');
    const emptyHtml = `<div class="empty-state" id="empty-state" style="display:none">
        <i class="fas fa-book-open"></i><h3>暂无知识文档</h3><p>点击「新建文档」开始记录运维知识</p></div>`;

    if (!docs.length) {
        list.innerHTML = emptyHtml;
        document.getElementById('empty-state').style.display = 'block';
        return;
    }

    list.innerHTML = docs.map(doc => {
        const color = doc.category_color || '#6b7280';
        const summary = doc.solution || doc.content || '';
        const tags = doc.tags ? doc.tags.split(',').filter(t => t.trim()).map(t =>
            `<span class="doc-tag">${t.trim()}</span>`).join('') : '';
        return `
        <div class="doc-item" onclick="viewDocument(${doc.id})">
            <span class="doc-category-badge" style="background:${color}">${doc.category || '未分类'}</span>
            <div class="doc-info">
                <div class="doc-title">${escapeHtml(doc.title)}</div>
                <div class="doc-summary">${escapeHtml(summary.substring(0, 150))}</div>
                <div class="doc-meta">
                    <span><i class="fas fa-clock"></i> ${formatTime(doc.updated_at)}</span>
                    <div class="doc-tags">${tags}</div>
                </div>
            </div>
            <div class="doc-actions">
                <button class="btn-icon" onclick="event.stopPropagation();editDocument(${doc.id})" title="编辑">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="event.stopPropagation();confirmDelete(${doc.id},'${escapeHtml(doc.title)}')" title="删除">
                    <i class="fas fa-trash" style="color:var(--danger)"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

// 渲染分页
function renderPagination(data) {
    const pag = document.getElementById('pagination');
    if (data.total_pages <= 1) {
        pag.style.display = 'none';
        return;
    }
    pag.style.display = 'flex';
    let html = `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">上一页</button>`;
    for (let i = 1; i <= data.total_pages; i++) {
        if (data.total_pages > 7 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== data.total_pages) {
            if (i === 2 || i === data.total_pages - 1) html += '<span style="padding:6px">...</span>';
            continue;
        }
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" ${currentPage >= data.total_pages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">下一页</button>`;
    pag.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    loadDocuments();
}

// 搜索防抖
const debounceSearch = debounce(() => {
    currentPage = 1;
    loadDocuments();
    document.getElementById('search-clear').style.display =
        document.getElementById('search-input').value ? 'block' : 'none';
});

function clearSearch() {
    document.getElementById('search-input').value = '';
    document.getElementById('search-clear').style.display = 'none';
    currentPage = 1;
    loadDocuments();
}

// HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 打开创建模态框
function openCreateModal() {
    document.getElementById('modal-title').textContent = '新建文档';
    document.getElementById('doc-id').value = '';
    document.getElementById('doc-title').value = '';
    document.getElementById('doc-category').value = '';
    document.getElementById('doc-tags').value = '';
    document.getElementById('doc-content').value = '';
    document.getElementById('doc-solution').value = '';
    document.getElementById('doc-modal').classList.add('active');
    document.getElementById('doc-title').focus();
}

// 编辑文档
async function editDocument(id) {
    try {
        const doc = await api(`/api/documents/${id}`);
        document.getElementById('modal-title').textContent = '编辑文档';
        document.getElementById('doc-id').value = doc.id;
        document.getElementById('doc-title').value = doc.title;
        document.getElementById('doc-category').value = doc.category;
        document.getElementById('doc-tags').value = doc.tags;
        document.getElementById('doc-content').value = doc.content;
        document.getElementById('doc-solution').value = doc.solution;
        document.getElementById('doc-modal').classList.add('active');
    } catch (e) {}
}

// 保存文档
async function saveDocument() {
    const id = document.getElementById('doc-id').value;
    const title = document.getElementById('doc-title').value.trim();
    if (!title) {
        showToast('请输入文档标题', 'error');
        return;
    }

    const data = {
        title,
        category: document.getElementById('doc-category').value,
        tags: document.getElementById('doc-tags').value,
        content: document.getElementById('doc-content').value,
        solution: document.getElementById('doc-solution').value
    };

    try {
        if (id) {
            await api(`/api/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            showToast('文档更新成功', 'success');
        } else {
            await api('/api/documents', { method: 'POST', body: JSON.stringify(data) });
            showToast('文档创建成功', 'success');
        }
        closeModal();
        loadDocuments();
        loadStats();
    } catch (e) {}
}

function closeModal() {
    document.getElementById('doc-modal').classList.remove('active');
}

// 查看文档详情
async function viewDocument(id) {
    try {
        const doc = await api(`/api/documents/${id}`);
        const color = doc.category_color || '#6b7280';
        document.getElementById('detail-title').innerHTML =
            `<span class="doc-category-badge" style="background:${color}">${doc.category || '未分类'}</span> ${escapeHtml(doc.title)}`;

        let body = '';
        if (doc.content) {
            body += `<div class="detail-section"><h4><i class="fas fa-question-circle"></i> 问题描述</h4><div class="detail-content">${renderMarkdown(doc.content)}</div></div>`;
        }
        if (doc.solution) {
            body += `<div class="detail-section"><h4><i class="fas fa-lightbulb"></i> 解决方案</h4><div class="detail-content">${renderMarkdown(doc.solution)}</div></div>`;
        }
        if (doc.tags) {
            body += `<div class="detail-section"><h4><i class="fas fa-tags"></i> 标签</h4><div class="doc-tags">${doc.tags.split(',').filter(t => t.trim()).map(t => `<span class="doc-tag">${t.trim()}</span>`).join('')}</div></div>`;
        }
        body += `<div class="detail-meta"><span><i class="fas fa-clock"></i> 创建：${doc.created_at}</span><span><i class="fas fa-edit"></i> 更新：${doc.updated_at}</span></div>`;

        document.getElementById('detail-body').innerHTML = body;
        document.getElementById('detail-edit-btn').onclick = () => {
            closeDetailModal();
            editDocument(id);
        };
        document.getElementById('detail-modal').classList.add('active');
    } catch (e) {}
}

function closeDetailModal() {
    document.getElementById('detail-modal').classList.remove('active');
}

// 删除文档
let deleteDocId = null;

function confirmDelete(id, title) {
    deleteDocId = id;
    document.getElementById('delete-doc-title').textContent = title;
    document.getElementById('delete-modal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    deleteDocId = null;
}

document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    if (!deleteDocId) return;
    try {
        await api(`/api/documents/${deleteDocId}`, { method: 'DELETE' });
        showToast('文档删除成功', 'success');
        closeDeleteModal();
        loadDocuments();
        loadStats();
    } catch (e) {}
});

// 点击模态框外部关闭
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });
});
