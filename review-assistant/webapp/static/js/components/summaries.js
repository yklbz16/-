/* 知识总结页面 — 流式生成，实时显示 */
var SummariesPage = {
  subjects: [],
  currentSubject: '',
  currentMode: '',
  gen: 0,

  render: function() {
    return `
      <div class="page-header">
        <h1>🧠 知识总结</h1>
        <p>AI帮你将零散知识点串联成体系化结构 — 实时生成，瞬间可见</p>
      </div>

      <div class="panel">
        <h2>🎯 生成总结</h2>
        <div id="summary-setup"></div>
      </div>

      <div id="summary-result"></div>`;
  },

  init: function(gen, pageName) {
    this.gen = gen;
    this.loadSubjects();
  },

  loadSubjects: function() {
    var self = this;
    API.getMaterials().then(function(data) {
      var container = document.getElementById('summary-setup');
      if (!container) return;
      self.subjects = data.subjects.filter(function(s) { return s.file_count > 0; });
      self.renderSetup();
    }).catch(function(e) {
      var container = document.getElementById('summary-setup');
      if (container) container.innerHTML = '<div class="alert alert-error">加载失败: ' + e.message + '</div>';
    });
  },

  renderSetup: function() {
    var container = document.getElementById('summary-setup');
    if (!container) return;

    if (!this.subjects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>还没有添加任何资料</p>
          <p class="text-sm">请先到「资料管理」上传课件或笔记</p>
        </div>`;
      return;
    }

    var options = '<option value="">请选择...</option>';
    for (var i = 0; i < this.subjects.length; i++) {
      options += '<option value="' + this.subjects[i].name + '">' + this.subjects[i].name + '</option>';
    }

    var modes = [
      { id: 'mindmap', icon: '🗺️', label: '思维导图', desc: 'Mermaid 格式思维导图' },
      { id: 'compare', icon: '⚖️', label: '概念对比', desc: '两个概念的对比辨析' },
      { id: 'cheatsheet', icon: '📋', label: '考前速记单', desc: '1页高频考点精华' },
      { id: 'chain', icon: '🔗', label: '知识链', desc: '概念间的逻辑串联' },
    ];

    var modesHtml = '';
    for (var j = 0; j < modes.length; j++) {
      modesHtml += '<div class="card" style="cursor:pointer;flex:1;min-width:140px;text-align:center;padding:16px" id="summary-mode-' + modes[j].id + '" onclick="SummariesPage.selectMode(\'' + modes[j].id + '\', this)"><div style="font-size:2rem">' + modes[j].icon + '</div><div style="font-weight:600;margin:4px 0">' + modes[j].label + '</div><div class="text-sm text-dim">' + modes[j].desc + '</div></div>';
    }

    container.innerHTML = `
      <div class="form-group">
        <label>选择科目</label>
        <select class="form-select" id="summary-subject" onchange="SummariesPage.onSubjectChange()">
          ${options}
        </select>
      </div>
      <div class="mb-2" style="display:flex;gap:10px;flex-wrap:wrap">${modesHtml}</div>
      <div id="summary-extra-params"></div>
      <button class="btn btn-primary btn-lg mt-2" id="summary-generate-btn" onclick="SummariesPage.generateStream()" disabled>🚀 生成</button>`;
  },

  selectMode: function(mode, el) {
    var cards = document.querySelectorAll('[id^="summary-mode-"]');
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.borderColor = 'var(--border)';
    }
    el.style.borderColor = 'var(--accent)';
    this.currentMode = mode;

    var btn = document.getElementById('summary-generate-btn');
    if (btn) btn.disabled = false;

    var extra = document.getElementById('summary-extra-params');
    if (!extra) return;

    if (mode === 'compare') {
      extra.innerHTML = '<div class="form-row mt-2"><div class="form-group"><label>概念 A</label><input class="form-input" id="summary-concept-a" placeholder="例如: 栈"></div><div class="form-group"><label>概念 B</label><input class="form-input" id="summary-concept-b" placeholder="例如: 队列"></div></div>';
    } else if (mode === 'chain') {
      extra.innerHTML = '<div class="form-group mt-2"><label>起始概念</label><input class="form-input" id="summary-start-concept" placeholder="例如: 二叉搜索树"></div>';
    } else {
      extra.innerHTML = '';
    }
  },

  onSubjectChange: function() {
    var el = document.getElementById('summary-subject');
    if (el) this.currentSubject = el.value;
  },

  generateStream: function() {
    var subjectEl = document.getElementById('summary-subject');
    if (!subjectEl) return;
    var subject = subjectEl.value;
    if (!subject) { showToast('请选择科目', 'warning'); return; }
    if (!this.currentMode) { showToast('请选择总结模式', 'warning'); return; }

    var self = this;
    var mode = this.currentMode;

    // 构建请求体
    var body = { subject: subject, mode: mode };
    if (mode === 'compare') {
      var aEl = document.getElementById('summary-concept-a');
      var bEl = document.getElementById('summary-concept-b');
      var a = (aEl && aEl.value) || '';
      var b = (bEl && bEl.value) || '';
      if (!a || !b) { showToast('请填写两个概念', 'warning'); return; }
      body.concept_a = a;
      body.concept_b = b;
    } else if (mode === 'chain') {
      var cEl = document.getElementById('summary-start-concept');
      var concept = (cEl && cEl.value) || '';
      if (!concept) { showToast('请填写起始概念', 'warning'); return; }
      body.start_concept = concept;
    }

    // 初始化结果区域
    var resultDiv = document.getElementById('summary-result');
    if (!resultDiv) return;
    var genId = 'gen-' + Date.now();
    resultDiv.innerHTML = '<div class="panel" id="' + genId + '"><h2>📄 实时生成中...</h2><div class="markdown-content" id="' + genId + '-content" style="min-height:120px;background:var(--bg);border-radius:8px;padding:16px;white-space:pre-wrap;font-size:0.95rem;line-height:1.7"><span class="spinner"></span> AI 正在思考...</div><div id="' + genId + '-status" class="text-sm text-dim mt-2"></div></div>';

    var container = document.getElementById(genId);
    var contentEl = document.getElementById(genId + '-content');
    var statusEl = document.getElementById(genId + '-status');
    if (!container || !contentEl) return;

    var fullText = '';
    var chunkCount = 0;
    var firstChunk = true;

    API.streamRequest(
      '/summary/generate-stream',
      body,
      // onChunk — 每收到一段文本立即显示
      function(chunk) {
        if (chunk.text) {
          if (firstChunk) {
            contentEl.textContent = '';
            firstChunk = false;
          }
          fullText += chunk.text;
          contentEl.textContent = fullText;
          chunkCount++;
          if (statusEl) statusEl.textContent = '已生成 ' + chunkCount + ' 片段，' + fullText.length + ' 字...';
        }
        if (chunk.saved) {
          if (statusEl) statusEl.innerHTML = '<span class="text-green">✅ 已保存: summaries/' + chunk.saved + '</span>';
        }
      },
      // onDone — 流式结束，渲染 Markdown + Mermaid
      function() {
        if (!container) return;
        var mermaidHtml = '';
        var displayContent = fullText;
        var mermaidMatch = fullText.match(/```mermaid\n([\s\S]*?)```/);
        if (mermaidMatch) {
          mermaidHtml = '<div class="mermaid mt-2 mb-2" style="background:#fff;border-radius:8px;padding:16px">' + mermaidMatch[1] + '</div>';
          displayContent = fullText.replace(/```mermaid\n[\s\S]*?```/, '');
        }

        container.innerHTML = '<h2>📄 生成结果</h2>' + mermaidHtml + '<div class="markdown-content">' + renderMarkdown(displayContent) + '</div>' + (statusEl ? '<div class="mt-2">' + statusEl.innerHTML + '</div>' : '');

        if (mermaidHtml && window.mermaid) {
          setTimeout(function() {
            try { mermaid.run({ querySelector: '.mermaid' }); } catch(e) {}
          }, 100);
        }

        // 刷新科目列表以获取更新
        self.loadSubjects();
      },
      // onError
      function(err) {
        if (container) {
          container.innerHTML = '<div class="alert alert-error">生成失败: ' + err + '<br><div class="text-sm mt-2">已生成部分内容:</div><div class="markdown-content mt-2" style="background:var(--bg);padding:12px;border-radius:8px">' + renderMarkdown(fullText) + '</div></div>';
        }
      }
    );
  },
};
