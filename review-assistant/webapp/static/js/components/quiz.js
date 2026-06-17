/* 测验抽背页面 — 每道题独立显示+独立答题 */
var QuizPage = {
  subjects: [],
  currentSubject: '',
  currentMode: 'concept',
  questionsText: '',
  questions: [],  // 拆分后的题目列表
  gen: 0,

  modes: [
    { id: 'concept', name: '💡 概念简答', desc: '核心概念的定义、原理或辨析' },
    { id: 'blank', name: '📝 填空', desc: '挖掉关键术语/公式，逐空填写' },
    { id: 'mixed', name: '📋 混合模拟卷', desc: '混合题型，模拟真实考试' },
    { id: 'weak', name: '🎯 薄弱点专练', desc: '针对高频错误知识点出题' },
    { id: 'quick', name: '⚡ 闪卡速刷', desc: '快速翻卡，自评掌握度' },
  ],

  render: function() {
    return `
      <div class="page-header">
        <h1>✍️ 测验抽背</h1>
        <p>6种出题模式，AI即时评分+纠错，错题自动入库 — 每题独立作答</p>
      </div>

      <div class="panel" id="quiz-setup-panel">
        <h2>🎯 开始测验</h2>
        <div id="quiz-setup"></div>
      </div>

      <div class="panel hidden" id="quiz-panel">
        <div class="flex-between mb-2">
          <h2 style="border:none;margin:0;padding:0" id="quiz-title">测验中...</h2>
          <button class="btn btn-sm" onclick="QuizPage.reset()">🔄 重新选择</button>
        </div>
        <div id="quiz-content"></div>
      </div>`;
  },

  init: function(gen, pageName) {
    this.gen = gen;
    this.loadSubjects();
  },

  loadSubjects: function() {
    var self = this;
    API.getMaterials().then(function(data) {
      var container = document.getElementById('quiz-setup');
      if (!container) return;
      self.subjects = data.subjects.filter(function(s) { return s.file_count > 0; });
      self.renderSetup();
    }).catch(function(e) {
      var container = document.getElementById('quiz-setup');
      if (container) container.innerHTML = '<div class="alert alert-error">加载失败: ' + e.message + '</div>';
    });
  },

  renderSetup: function() {
    var container = document.getElementById('quiz-setup');
    if (!container) return;

    if (!this.subjects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>还没有添加任何资料</p>
          <p class="text-sm">请先到「资料管理」上传课件或笔记</p>
          <button class="btn btn-primary mt-2" onclick="App.navigate('materials')">📚 去添加资料</button>
        </div>`;
      return;
    }

    var options = '';
    for (var i = 0; i < this.subjects.length; i++) {
      options += '<option value="' + this.subjects[i].name + '">' + this.subjects[i].name + ' (' + this.subjects[i].knowledge_count + '个知识点)</option>';
    }

    var modesHtml = '';
    for (var j = 0; j < this.modes.length; j++) {
      var m = this.modes[j];
      var borderColor = j === 0 ? 'var(--accent)' : 'var(--border)';
      var textColor = j === 0 ? 'var(--accent)' : 'var(--text)';
      modesHtml += '<div class="card" style="cursor:pointer;margin-bottom:8px;border-color:' + borderColor + '" onclick="QuizPage.selectMode(\'' + m.id + '\', this)"><h4 style="margin:0 0 4px;color:' + textColor + '">' + m.name + '</h4><p style="margin:0;color:var(--dim);font-size:0.85rem">' + m.desc + '</p></div>';
    }

    container.innerHTML = `
      <div class="form-row mb-2">
        <div class="form-group">
          <label>选择科目</label>
          <select class="form-select" id="quiz-subject">${options}</select>
        </div>
        <div class="form-group" style="flex:0;min-width:100px">
          <label>题数</label>
          <input class="form-input" type="number" id="quiz-count" value="5" min="1" max="30" style="width:80px">
        </div>
      </div>
      <div class="mb-2" id="quiz-mode-selector">${modesHtml}</div>
      <button class="btn btn-primary btn-lg" onclick="QuizPage.start()">🚀 开始测验</button>`;
  },

  selectMode: function(modeId, el) {
    this.currentMode = modeId;
    var cards = document.querySelectorAll('#quiz-mode-selector .card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.borderColor = 'var(--border)';
      cards[i].querySelector('h4').style.color = 'var(--text)';
    }
    el.style.borderColor = 'var(--accent)';
    el.querySelector('h4').style.color = 'var(--accent)';
  },

  // 将题目文本按 --- 拆分
  splitQuestions: function(text) {
    var parts = text.split(/\n---\r?\n/);
    var result = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      var num = i + 1;
      var topic = '综合';
      var body = p;
      // 提取 **第X题**（知识点：XXX）
      var m = p.match(/\*\*第\s*(\d+)\s*题\*\*[（(]([^）)]*)[）)]/);
      if (m) {
        num = parseInt(m[1]) || (i + 1);
        topic = m[2].trim();
        body = p.substring(m[0].length).trim();
      }
      result.push({ number: num, topic: topic, body: body, full: p });
    }
    return result.length ? result : [{ number: 1, topic: '综合', body: text, full: text }];
  },

  start: function() {
    var subjectEl = document.getElementById('quiz-subject');
    var countEl = document.getElementById('quiz-count');
    if (!subjectEl || !countEl) return;
    var subject = subjectEl.value;
    var count = parseInt(countEl.value) || 5;

    if (!subject) { showToast('请选择科目', 'warning'); return; }

    this.currentSubject = subject;

    var setupPanel = document.getElementById('quiz-setup-panel');
    var quizPanel = document.getElementById('quiz-panel');
    if (!setupPanel || !quizPanel) return;
    setupPanel.classList.add('hidden');
    quizPanel.classList.remove('hidden');

    var modeName = '测验';
    for (var i = 0; i < this.modes.length; i++) {
      if (this.modes[i].id === this.currentMode) { modeName = this.modes[i].name; break; }
    }
    var titleEl = document.getElementById('quiz-title');
    if (titleEl) titleEl.textContent = modeName + ' — ' + subject;

    var content = document.getElementById('quiz-content');
    if (!content) return;
    content.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> AI 正在出题中...</div>';

    var self = this;
    API.generateQuiz({
      subject: subject,
      mode: this.currentMode,
      count: count,
    }).then(function(data) {
      self.questionsText = data.questions_text;
      // 优先用服务端拆分结果，否则前端自己拆
      if (data.questions && data.questions.length) {
        self.questions = data.questions;
      } else {
        self.questions = self.splitQuestions(data.questions_text);
      }
      self.renderQuestions();
    }).catch(function(e) {
      var c = document.getElementById('quiz-content');
      if (c) c.innerHTML = '<div class="alert alert-error">出题失败: ' + e.message + '</div>';
    });
  },

  renderQuestions: function() {
    var content = document.getElementById('quiz-content');
    if (!content) return;

    if (!this.questions.length) {
      content.innerHTML = '<div class="alert alert-warning">未能解析出题目，请重试</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < this.questions.length; i++) {
      var q = this.questions[i];
      html += '<div class="quiz-question" id="q-card-' + i + '">';
      html += '<div class="flex-between mb-1">';
      html += '<span class="tag tag-blue">第' + q.number + '题</span>';
      html += '<span class="text-sm text-dim">知识点：' + q.topic + '</span>';
      html += '</div>';
      html += '<div class="markdown-content" style="margin-bottom:12px">' + renderMarkdown(q.body) + '</div>';
      html += '<label class="text-sm" style="color:var(--dim)">✏️ 你的答案：</label>';
      html += '<textarea class="form-textarea quiz-answer" id="answer-' + i + '" placeholder="在此作答..." style="min-height:60px"></textarea>';
      html += '</div>';
    }

    html += '<div class="flex-gap mt-2">';
    html += '<button class="btn btn-primary" onclick="QuizPage.grade()">📝 提交批改（全部）</button>';
    html += '<button class="btn" onclick="QuizPage.start()">🔄 换一批题</button>';
    html += '<button class="btn" onclick="QuizPage.reset()">↩️ 重新选择</button>';
    html += '</div>';
    html += '<div id="grading-result"></div>';

    content.innerHTML = html;
  },

  grade: function() {
    var self = this;

    // 收集每道题的答案
    var answers = [];
    for (var i = 0; i < this.questions.length; i++) {
      var el = document.getElementById('answer-' + i);
      var a = (el && el.value || '').trim();
      if (a) {
        answers.push({
          number: this.questions[i].number,
          topic: this.questions[i].topic,
          question: this.questions[i].body.slice(0, 300),
          answer: a,
        });
      }
    }

    if (!answers.length) { showToast('请至少回答一道题', 'warning'); return; }

    var resultDiv = document.getElementById('grading-result');
    if (!resultDiv) return;
    resultDiv.innerHTML = '<div class="loading-overlay mt-2"><span class="spinner"></span> AI 正在批改 ' + answers.length + ' 道题...</div>';

    // 构建格式化的答题内容
    var answerText = '';
    for (var j = 0; j < answers.length; j++) {
      answerText += '**第' + answers[j].number + '题**（' + answers[j].topic + '）\n题目：' + answers[j].question + '\n我的答案：' + answers[j].answer + '\n\n';
    }

    API.gradeQuiz({
      subject: this.currentSubject,
      topic: this.currentMode,
      question: this.questionsText.slice(0, 3000),
      user_answer: answerText,
      correct_answer: '',
    }).then(function(data) {
      // 高亮每道题的状态
      for (var k = 0; k < self.questions.length; k++) {
        var card = document.getElementById('q-card-' + k);
        if (!card) continue;
        // 如果 AI 提到了该题号正确，标绿；否则根据整体判断
        if (data.is_correct) {
          card.style.borderLeft = '3px solid var(--green)';
        } else if (data.is_partial) {
          card.style.borderLeft = '3px solid var(--amber)';
        } else {
          card.style.borderLeft = '3px solid var(--red)';
        }
      }

      var r = document.getElementById('grading-result');
      if (!r) return;

      var resultClass = data.is_correct ? 'grading-correct' : (data.is_partial ? 'grading-partial' : 'grading-wrong');
      var statusText = data.is_correct ? '✅ 全部正确！' : (data.is_partial ? '⚠️ 部分正确' : '❌ 有误');
      var errorTag = data.error_id ? '<div class="mt-1"><span class="tag tag-red">错题已记录: ' + data.error_id + '</span></div>' : '';

      r.innerHTML = `
        <div class="grading-result ${resultClass}">
          <div class="text-lg mb-1">${statusText}</div>
          <div class="markdown-content">${renderMarkdown(data.grading)}</div>
          ${errorTag}
        </div>`;

      if (!data.is_correct) {
        showToast('错题已自动入库 (' + data.error_id + ')', 'info');
      }
    }).catch(function(e) {
      var r2 = document.getElementById('grading-result');
      if (r2) r2.innerHTML = '<div class="alert alert-error mt-2">批改失败: ' + e.message + '</div>';
    });
  },

  reset: function() {
    var setupPanel = document.getElementById('quiz-setup-panel');
    var quizPanel = document.getElementById('quiz-panel');
    if (setupPanel) setupPanel.classList.remove('hidden');
    if (quizPanel) quizPanel.classList.add('hidden');
    var content = document.getElementById('quiz-content');
    if (content) content.innerHTML = '';
    this.questions = [];
  },
};
