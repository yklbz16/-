/* 资料管理页面 — 支持批量上传/粘贴 */

var MaterialsPage = {
  subjects: [],
  gen: 0,
  batchRows: [],  // 批量粘贴的行数据

  render: function() {
    return `
      <div class="page-header">
        <h1>📚 资料管理</h1>
        <p>提交课件/笔记/题库，AI 自动解析知识点结构 — 支持批量导入</p>
      </div>

      <div class="panel">
        <h2>➕ 添加资料</h2>
        <div class="tab-bar">
          <div class="tab-item active" onclick="MaterialsPage.switchTab('file')">📁 批量上传文件</div>
          <div class="tab-item" onclick="MaterialsPage.switchTab('text')">📝 粘贴文本</div>
          <div class="tab-item" onclick="MaterialsPage.switchTab('batch')">📋 批量粘贴</div>
        </div>
        <div id="add-material-tab"></div>
      </div>

      <div id="scan-result"></div>

      <div class="panel">
        <div class="flex-between mb-2">
          <h2 style="border:none;margin:0;padding:0">📂 资料列表</h2>
          <div class="flex-gap">
            <button class="btn btn-sm btn-accent" onclick="MaterialsPage.batchParseAll()">🚀 一键解析全部</button>
            <button class="btn btn-sm" onclick="MaterialsPage.scan()">🔍 扫描覆盖度</button>
            <button class="btn btn-sm" onclick="MaterialsPage.refresh()">🔄 刷新</button>
          </div>
        </div>
        <div id="materials-list">
          <div class="loading-overlay"><span class="spinner"></span> 加载中...</div>
        </div>
      </div>`;
  },

  init: function(gen, pageName) {
    this.gen = gen;
    this.batchRows = [];
    this.renderAddTab('file');
    this.loadSubjects();
  },

  switchTab: function(tab) {
    var items = document.querySelectorAll('.tab-item');
    for (var i = 0; i < items.length; i++) {
      var idx = i;
      items[i].classList.toggle('active',
        (idx === 0 && tab === 'file') ||
        (idx === 1 && tab === 'text') ||
        (idx === 2 && tab === 'batch'));
    }
    this.renderAddTab(tab);
  },

  renderAddTab: function(tab) {
    var container = document.getElementById('add-material-tab');
    if (!container) return;

    if (tab === 'file') {
      container.innerHTML = `
        <div class="form-group">
          <label>科目名称</label>
          <input class="form-input" id="upload-subject" placeholder="例如: 数据结构、高等数学...">
        </div>
        <div class="form-group">
          <label>选择文件 (支持多选: .md, .txt, .pdf, .pptx)</label>
          <input class="form-input" type="file" id="upload-file" accept=".md,.txt,.pdf,.pptx" multiple
                 onchange="MaterialsPage.onFilesSelected()">
          <div class="form-hint" id="file-hint" style="margin-top:4px">可一次选择多个文件，全部归入同一科目</div>
        </div>
        <div id="batch-file-list"></div>
        <button class="btn btn-primary" id="btn-upload" onclick="MaterialsPage.uploadBatch()" disabled>📤 上传并解析</button>
        <span id="upload-status" style="margin-left:12px;font-size:0.9rem"></span>`;
    } else if (tab === 'text') {
      container.innerHTML = `
        <div class="form-group">
          <label>科目名称</label>
          <input class="form-input" id="text-subject" placeholder="例如: 数据结构">
        </div>
        <div class="form-group">
          <label>资料内容 (支持 Markdown)</label>
          <textarea class="form-textarea" id="text-content" placeholder="在此粘贴课件/笔记内容..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="MaterialsPage.addText()">📤 提交并解析</button>`;
    } else if (tab === 'batch') {
      // 批量粘贴模式
      var rows = '';
      for (var i = 0; i < this.batchRows.length; i++) {
        var r = this.batchRows[i];
        rows += '<div class="card mb-2" style="position:relative">';
        rows += '<button class="btn btn-sm btn-danger" style="position:absolute;top:8px;right:8px" onclick="MaterialsPage.removeBatchRow(' + i + ')">✕</button>';
        rows += '<div class="form-row" style="flex-wrap:wrap">';
        rows += '<div class="form-group" style="min-width:160px;flex:1"><label>科目</label><input class="form-input batch-subject" value="' + this.escapeHtml(r.subject || '') + '" placeholder="科目名称"></div>';
        rows += '</div>';
        rows += '<div class="form-group"><label>内容 (Markdown)</label><textarea class="form-textarea batch-content" style="min-height:100px" placeholder="粘贴该科目的笔记/课件内容...">' + this.escapeHtml(r.content || '') + '</textarea></div>';
        rows += '</div>';
      }
      if (this.batchRows.length === 0) {
        rows = '<p class="text-dim" style="padding:12px 0">还没有添加条目，点击下方按钮开始</p>';
      }
      container.innerHTML = `
        ${rows}
        <div class="flex-gap">
          <button class="btn" onclick="MaterialsPage.addBatchRow()">➕ 添加一科</button>
          <button class="btn btn-primary" onclick="MaterialsPage.submitBatch()" ${this.batchRows.length === 0 ? 'disabled' : ''}>📤 批量提交全部</button>
        </div>`;
    }
  },

  // ========== 批量文件上传 ==========

  onFilesSelected: function() {
    var fileEl = document.getElementById('upload-file');
    var btn = document.getElementById('btn-upload');
    var hint = document.getElementById('file-hint');
    var list = document.getElementById('batch-file-list');

    if (!fileEl || !fileEl.files.length) {
      if (btn) btn.disabled = true;
      if (hint) hint.textContent = '可一次选择多个文件，全部归入同一科目';
      if (list) list.innerHTML = '';
      return;
    }

    if (btn) btn.disabled = false;
    if (hint) hint.textContent = '已选择 ' + fileEl.files.length + ' 个文件，全部归入同一科目';

    var html = '<div class="card mb-2"><h4 style="margin:0 0 8px">📋 待上传文件列表</h4>';
    for (var i = 0; i < fileEl.files.length; i++) {
      var f = fileEl.files[i];
      var sizeKb = (f.size / 1024).toFixed(1);
      html += '<div class="flex-between text-sm" style="padding:3px 0;color:var(--dim)"><span>📎 ' + f.name + '</span><span>' + sizeKb + ' KB</span></div>';
    }
    html += '</div>';
    if (list) list.innerHTML = html;
  },

  uploadBatch: function() {
    var subjectEl = document.getElementById('upload-subject');
    var fileEl = document.getElementById('upload-file');
    if (!subjectEl || !fileEl) return;

    var subject = subjectEl.value.trim();
    var files = fileEl.files;

    if (!subject) { showToast('请输入科目名称', 'warning'); return; }
    if (!files.length) { showToast('请选择文件', 'warning'); return; }

    var self = this;
    var statusEl = document.getElementById('upload-status');
    var btn = document.getElementById('btn-upload');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 上传中...'; }

    API.uploadMaterials(subject, files).then(function(result) {
      if (statusEl) statusEl.innerHTML = '<span class="text-green">✅ ' + result.count + ' 个文件上传成功</span>';
      showToast('已添加 ' + result.count + ' 份资料: ' + subject, 'success');
      // 自动解析
      return API.parseMaterial(subject);
    }).then(function() {
      showToast(subject + ' 知识点解析完成', 'success');
      self.loadSubjects();
    }).catch(function(e) {
      showToast('上传失败: ' + e.message, 'error');
      if (statusEl) statusEl.innerHTML = '<span class="text-red">❌ ' + e.message + '</span>';
    }).finally(function() {
      if (btn) { btn.disabled = false; btn.textContent = '📤 上传并解析'; }
    });
  },

  // ========== 单条粘贴文本 ==========

  addText: function() {
    var subjectEl = document.getElementById('text-subject');
    var contentEl = document.getElementById('text-content');
    if (!subjectEl || !contentEl) return;
    var subject = subjectEl.value.trim();
    var content = contentEl.value.trim();

    if (!subject) { showToast('请输入科目名称', 'warning'); return; }
    if (!content) { showToast('请输入资料内容', 'warning'); return; }

    var self = this;
    showToast('提交中...', 'info');
    API.addTextMaterial(subject, content).then(function() {
      showToast('资料已保存', 'success');
      return API.parseMaterial(subject);
    }).then(function() {
      showToast('知识点解析完成', 'success');
      self.loadSubjects();
    }).catch(function(e) {
      showToast('提交失败: ' + e.message, 'error');
    });
  },

  // ========== 批量粘贴 ==========

  addBatchRow: function() {
    this.batchRows.push({ subject: '', content: '' });
    this.renderAddTab('batch');
  },

  removeBatchRow: function(index) {
    this.batchRows.splice(index, 1);
    this.renderAddTab('batch');
  },

  submitBatch: function() {
    // 从 DOM 读取最新的输入值
    var subjectInputs = document.querySelectorAll('.batch-subject');
    var contentInputs = document.querySelectorAll('.batch-content');
    var entries = [];

    for (var i = 0; i < subjectInputs.length; i++) {
      var subject = (subjectInputs[i].value || '').trim();
      var content = (contentInputs[i] && contentInputs[i].value || '').trim();
      if (subject && content) {
        entries.push({ subject: subject, content: content });
      }
    }

    if (!entries.length) {
      showToast('请至少填写一个科目的名称和内容', 'warning');
      return;
    }

    var self = this;
    showToast('批量提交 ' + entries.length + ' 条资料中...', 'info');

    API.batchAddText(entries).then(function(result) {
      showToast('已添加 ' + result.count + ' 条资料', 'success');
      // 批量解析所有涉及到的科目
      var uniqueSubjects = [];
      var seen = {};
      for (var i = 0; i < result.results.length; i++) {
        var s = result.results[i].subject;
        if (!seen[s]) { seen[s] = true; uniqueSubjects.push(s); }
      }
      if (uniqueSubjects.length > 0) {
        showToast('正在解析 ' + uniqueSubjects.length + ' 个科目...', 'info');
        return API.batchParse(uniqueSubjects);
      }
    }).then(function(parseResult) {
      if (parseResult) {
        showToast('解析完成: ' + parseResult.succeeded + '/' + parseResult.total + ' 成功', 'success');
      }
      self.batchRows = [];
      self.loadSubjects();
    }).catch(function(e) {
      showToast('批量提交失败: ' + e.message, 'error');
    });
  },

  // ========== 批量解析全部科目 ==========

  batchParseAll: function() {
    if (!this.subjects.length) {
      showToast('没有资料可解析，请先添加资料', 'warning');
      return;
    }

    var names = [];
    for (var i = 0; i < this.subjects.length; i++) {
      names.push(this.subjects[i].name);
    }

    var self = this;
    showToast('正在解析 ' + names.length + ' 个科目...', 'info');

    API.batchParse(names).then(function(result) {
      var msg = '解析完成: ' + result.succeeded + ' 成功';
      if (result.failed > 0) msg += ', ' + result.failed + ' 失败';
      showToast(msg, result.failed > 0 ? 'warning' : 'success');
      self.loadSubjects();
    }).catch(function(e) {
      showToast('批量解析失败: ' + e.message, 'error');
    });
  },

  // ========== 资料列表 ==========

  loadSubjects: function() {
    var self = this;
    API.getMaterials().then(function(data) {
      var container = document.getElementById('materials-list');
      if (!container) return;
      self.subjects = data.subjects;
      self.renderList();
    }).catch(function(e) {
      var container = document.getElementById('materials-list');
      if (container) container.innerHTML = '<div class="alert alert-error">加载失败: ' + e.message + '</div>';
    });
  },

  renderList: function() {
    var container = document.getElementById('materials-list');
    if (!container) return;
    if (!this.subjects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>还没有添加任何资料</p>
          <p class="text-sm">上传课件或粘贴笔记，支持批量导入，AI 将自动解析知识点</p>
        </div>`;
      return;
    }

    var html = '';
    for (var i = 0; i < this.subjects.length; i++) {
      var s = this.subjects[i];
      html += '<div class="card mb-2"><div class="flex-between"><div>';
      html += '<h3 style="margin:0 0 8px;color:var(--text)">📘 ' + s.name + '</h3>';
      html += '<div class="flex-gap text-sm text-dim">';
      html += '<span>📄 ' + s.file_count + ' 份资料</span>';
      html += '<span>📌 ' + s.knowledge_count + ' 个知识点</span>';
      html += s.file_count > 0 ? '<span class="tag tag-green">已解析</span>' : '<span class="tag tag-amber">待添加</span>';
      html += '</div></div>';
      html += '<button class="btn btn-sm btn-danger" onclick="MaterialsPage.deleteSubject(\'' + s.name + '\')">🗑️</button>';
      html += '</div>';
      if (s.files.length) {
        html += '<div class="mt-2">';
        for (var j = 0; j < s.files.length; j++) {
          html += '<div class="flex-between text-sm" style="padding:4px 0;color:var(--dim)"><span>📎 ' + s.files[j].name + '</span><span>' + (s.files[j].size / 1024).toFixed(1) + ' KB</span></div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    container.innerHTML = html;
  },

  scan: function() {
    var self = this;
    API.scanMaterials().then(function(data) {
      var container = document.getElementById('scan-result');
      if (!container) return;
      var coverage = data.coverage;
      var html = '<div class="panel"><h2>🔍 覆盖度扫描结果</h2>';
      if (!coverage.length) {
        html += '<p class="text-dim">暂无资料可扫描</p>';
      } else {
        html += '<table><tr><th>科目</th><th>资料数</th><th>知识点</th><th>已出题</th><th>覆盖率</th></tr>';
        for (var i = 0; i < coverage.length; i++) {
          var c = coverage[i];
          var cls = c.coverage_pct > 50 ? 'text-green' : c.coverage_pct > 20 ? 'text-amber' : 'text-red';
          html += '<tr><td>' + c.subject + '</td><td>' + c.materials + '</td><td>' + c.knowledge_items + '</td><td>' + c.questions_used + '</td><td class="' + cls + '">' + c.coverage_pct + '%</td></tr>';
        }
        html += '</table>';
      }
      html += '</div>';
      container.innerHTML = html;
    }).catch(function(e) {
      showToast('扫描失败: ' + e.message, 'error');
    });
  },

  deleteSubject: function(name) {
    if (!confirm('确定删除科目「' + name + '」的所有资料吗？')) return;
    var self = this;
    var files = [];
    for (var i = 0; i < this.subjects.length; i++) {
      if (this.subjects[i].name === name) {
        files = this.subjects[i].files;
        break;
      }
    }
    var deletePromises = [];
    for (var j = 0; j < files.length; j++) {
      deletePromises.push(API.deleteMaterial(name, files[j].name));
    }
    Promise.all(deletePromises).then(function() {
      showToast('已删除科目: ' + name, 'info');
      self.loadSubjects();
    }).catch(function(e) {
      showToast('删除失败: ' + e.message, 'error');
    });
  },

  refresh: function() { this.loadSubjects(); },

  escapeHtml: function(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
};
