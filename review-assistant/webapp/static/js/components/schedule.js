/* 考试日程 — 日历视图 + 倒计时 + 语录 */
var SchedulePage = {
  examDates: {},
  currentYear: 0,
  currentMonth: 0,
  gen: 0,

  quotes: {
    critical: ['🔥 最后冲刺！你已经走了99步，就差这最后一跃。','⚡ 大战在即，深呼吸。你准备得比想象中更好。','🎯 临阵磨枪，不快也光。抓住每一个薄弱点！','💪 紧张是正常的，它证明你在乎。相信自己！'],
    urgent:   ['⏰ 倒计时一周！现在的每分每秒都在为成功铺路。','📖 复习不是重复，是每一次都有新的理解。','🏃 坚持住！一周后的你会感谢现在努力的自己。','🌟 压力是成长的催化剂，你正在变强。'],
    close:    ['📋 按部就班，稳扎稳打。时间站在你这边。','🗓️ 每天进步一点点，考试那天你就是最强的。','🎓 知识的积累如同复利，越到后面威力越大。','💡 与其焦虑，不如行动。今天搞懂一个知识点就是胜利。'],
    far:      ['🌱 充足的准备时间是最大的优势，好好利用。','📚 日拱一卒，功不唐捐。知识的种子正在生根发芽。','🏔️ 远方的山看起来很高，但每一步都在缩短距离。','🎯 规划比努力更重要，制定好计划，然后坚决执行。'],
    none:     ['📅 点击日历上的某个日期，添加考试日程。','💭 不知道什么时候考试？先设一个目标日期，动力会随之而来。'],
  },

  render: function() {
    return `
      <div class="page-header">
        <h1>📅 考试日程</h1>
        <p>日历式管理考试日期，自动倒计时 + 激励语录</p>
      </div>

      <div class="card-grid" style="grid-template-columns:340px 1fr">
        <!-- 左栏：日历 -->
        <div class="panel" style="padding:12px">
          <div class="flex-between mb-2">
            <button class="btn btn-sm" onclick="SchedulePage.prevMonth()">◀</button>
            <strong id="cal-title" style="font-size:1rem">2026年 6月</strong>
            <button class="btn btn-sm" onclick="SchedulePage.nextMonth()">▶</button>
          </div>
          <div id="calendar-grid"></div>
        </div>

        <!-- 右栏：日程详情 -->
        <div class="panel">
          <h2 style="border:none;margin:0 0 8px;padding:0">⏳ 考试倒计时</h2>
          <div id="schedule-detail">
            <div class="loading-overlay"><span class="spinner"></span></div>
          </div>
        </div>
      </div>`;
  },

  init: function(gen, pageName) {
    this.gen = gen;
    this.loadDates();

    var today = new Date();
    this.currentYear = today.getFullYear();
    this.currentMonth = today.getMonth() + 1;
    this.renderCalendar();
    this.renderDetail();
  },

  // ====== 数据 ======

  loadDates: function() {
    try {
      this.examDates = JSON.parse(localStorage.getItem('review_exam_dates') || '{}');
    } catch (e) { this.examDates = {}; }
  },

  saveDates: function() {
    try { localStorage.setItem('review_exam_dates', JSON.stringify(this.examDates)); } catch (e) {}
  },

  // ====== 日历 ======

  prevMonth: function() {
    this.currentMonth--;
    if (this.currentMonth < 1) { this.currentMonth = 12; this.currentYear--; }
    this.renderCalendar();
  },

  nextMonth: function() {
    this.currentMonth++;
    if (this.currentMonth > 12) { this.currentMonth = 1; this.currentYear++; }
    this.renderCalendar();
  },

  renderCalendar: function() {
    var title = document.getElementById('cal-title');
    if (title) title.textContent = this.currentYear + '年 ' + this.currentMonth + '月';

    var grid = document.getElementById('calendar-grid');
    if (!grid) return;

    var firstDay = new Date(this.currentYear, this.currentMonth - 1, 1);
    var lastDay = new Date(this.currentYear, this.currentMonth, 0);
    var startDow = firstDay.getDay(); // 0=Sun
    var daysInMonth = lastDay.getDate();
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // 构建日期索引：dateStr → 日程信息
    var dateMap = {};
    var keys = Object.keys(this.examDates);
    for (var i = 0; i < keys.length; i++) {
      var d = this.examDates[keys[i]].date;
      if (!dateMap[d]) dateMap[d] = [];
      dateMap[d].push({ subject: keys[i], label: this.examDates[keys[i]].label });
    }

    var html = '<div class="cal-weekdays">';
    var dayNames = ['日','一','二','三','四','五','六'];
    for (var w = 0; w < 7; w++) {
      var cls = (w === 0 || w === 6) ? 'cal-day-header weekend' : 'cal-day-header';
      html += '<div class="' + cls + '">' + dayNames[w] + '</div>';
    }
    html += '</div><div class="cal-grid">';

    // 填充空白
    for (var b = 0; b < startDow; b++) {
      html += '<div class="cal-cell empty"></div>';
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = this.currentYear + '-' +
        String(this.currentMonth).padStart(2, '0') + '-' +
        String(day).padStart(2, '0');
      var dateObj = new Date(this.currentYear, this.currentMonth - 1, day);
      var isToday = dateObj.getTime() === today.getTime();
      var isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

      var classes = 'cal-cell';
      if (isToday) classes += ' cal-today';
      if (isWeekend) classes += ' cal-weekend';

      var dot = '';
      if (dateMap[dateStr]) {
        classes += ' cal-has-exam';
        var urgency = '';
        var daysLeft = Math.ceil((dateObj - today) / 86400000);
        if (daysLeft < 0) urgency = 'done';
        else if (daysLeft <= 3) urgency = 'critical';
        else if (daysLeft <= 7) urgency = 'urgent';
        else if (daysLeft <= 30) urgency = 'close';
        else urgency = 'far';
        dot = '<span class="cal-dot ' + urgency + '">●</span>';
      }

      html += '<div class="' + classes + '" onclick="SchedulePage.clickDate(\'' + dateStr + '\')" title="' + dateStr + '">';
      html += '<span class="cal-day-num">' + day + '</span>';
      html += dot;
      if (dateMap[dateStr]) {
        for (var e = 0; e < dateMap[dateStr].length; e++) {
          html += '<span class="cal-label">' + dateMap[dateStr][e].subject + '</span>';
        }
      }
      html += '</div>';
    }

    html += '</div>';
    grid.innerHTML = html;
  },

  clickDate: function(dateStr) {
    var existing = null;
    // 查找该日期是否有考试
    var keys = Object.keys(this.examDates);
    for (var i = 0; i < keys.length; i++) {
      if (this.examDates[keys[i]].date === dateStr) {
        existing = keys[i];
        break;
      }
    }
    this.showModal(existing, dateStr);
  },

  // ====== 对话框 ======

  showModal: function(existingSubject, presetDate) {
    var existing = existingSubject ? this.examDates[existingSubject] : null;
    var defSubject = existingSubject || '';
    var defLabel = existing ? existing.label : '';
    var defDate = existing ? existing.date : (presetDate || '');

    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'schedule-modal';
    modal.onclick = function(e) { if (e.target === this) SchedulePage.closeModal(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:380px" onclick="event.stopPropagation()">
        <h3 style="margin:0 0 14px">📅 ${existingSubject ? '编辑' : '添加'}考试</h3>
        <div class="form-group">
          <label>科目名称</label>
          <input class="form-input" id="sched-subject" value="${defSubject}" placeholder="例如: 高等数学">
        </div>
        <div class="form-group">
          <label>标签</label>
          <input class="form-input" id="sched-label" value="${defLabel}" placeholder="例如: 期末考试">
        </div>
        <div class="form-group">
          <label>日期</label>
          <input class="form-input" type="date" id="sched-date" value="${defDate}">
        </div>
        ${existingSubject ? '<button class="btn btn-danger btn-sm mt-1" onclick="SchedulePage.remove(\'' + existingSubject.replace(/'/g,"\\'") + '\');SchedulePage.closeModal()">🗑️ 删除此日程</button>' : ''}
        <div class="flex-gap mt-3">
          <button class="btn btn-primary" onclick="SchedulePage.save()">💾 保存</button>
          <button class="btn" onclick="SchedulePage.closeModal()">取消</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  save: function() {
    var subj = document.getElementById('sched-subject');
    var label = document.getElementById('sched-label');
    var date = document.getElementById('sched-date');
    if (!subj || !date) return;

    var subject = subj.value.trim();
    var dateVal = date.value;
    if (!subject) { showToast('请输入科目名称', 'warning'); return; }
    if (!dateVal) { showToast('请选择日期', 'warning'); return; }

    this.examDates[subject] = {
      date: dateVal,
      label: (label && label.value || '').trim() || subject,
    };
    this.saveDates();
    this.closeModal();
    this.renderCalendar();
    this.renderDetail();
    showToast('✅ 已保存', 'success');
  },

  remove: function(subject) {
    delete this.examDates[subject];
    this.saveDates();
    this.renderCalendar();
    this.renderDetail();
    showToast('已删除', 'info');
  },

  closeModal: function() {
    var m = document.getElementById('schedule-modal');
    if (m) m.remove();
  },

  // ====== 详情面板 ======

  getQuote: function(days) {
    var pool;
    if (days < 0) { return '✅ 考试已结束！回顾错题，总结经验。'; }
    else if (days <= 3) pool = this.quotes.critical;
    else if (days <= 7) pool = this.quotes.urgent;
    else if (days <= 30) pool = this.quotes.close;
    else pool = this.quotes.far;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  renderDetail: function() {
    var container = document.getElementById('schedule-detail');
    if (!container) return;

    var keys = Object.keys(this.examDates);
    if (!keys.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:20px">
          <div class="empty-icon">📅</div>
          <p>还没有考试日程</p>
          <p class="text-sm">💬 点击左侧日历上的某个日期来添加</p>
        </div>`;
      return;
    }

    // 按日期排序
    var sorted = [];
    for (var i = 0; i < keys.length; i++) {
      sorted.push({ subject: keys[i], date: this.examDates[keys[i]].date, label: this.examDates[keys[i]].label });
    }
    sorted.sort(function(a, b) { return a.date.localeCompare(b.date); });

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var html = '';

    for (var j = 0; j < sorted.length; j++) {
      var item = sorted[j];
      var examDate = new Date(item.date + 'T00:00:00');
      var daysLeft = Math.ceil((examDate - today) / 86400000);

      var borderColor, badgeClass, badgeText;
      if (daysLeft < 0) {
        borderColor = 'var(--dim)'; badgeClass = 'tag'; badgeText = '已结束';
      } else if (daysLeft === 0) {
        borderColor = 'var(--red)'; badgeClass = 'tag tag-red'; badgeText = '⚠️ 今天考试！';
      } else if (daysLeft <= 3) {
        borderColor = 'var(--red)'; badgeClass = 'tag tag-red'; badgeText = '仅剩 ' + daysLeft + ' 天';
      } else if (daysLeft <= 7) {
        borderColor = 'var(--amber)'; badgeClass = 'tag tag-amber'; badgeText = '剩 ' + daysLeft + ' 天';
      } else if (daysLeft <= 30) {
        borderColor = 'var(--accent)'; badgeClass = 'tag tag-blue'; badgeText = '剩 ' + daysLeft + ' 天';
      } else {
        borderColor = 'var(--green)'; badgeClass = 'tag tag-green'; badgeText = daysLeft + ' 天后';
      }

      var pct = daysLeft < 0 ? 100 : Math.min(100, Math.max(5, Math.round((1 - daysLeft / 90) * 100)));
      var progColor = daysLeft <= 7 ? 'red' : daysLeft <= 30 ? 'amber' : 'green';
      var quote = this.getQuote(daysLeft);

      html += '<div class="card mb-2" style="border-left:4px solid ' + borderColor + '">';
      html += '<div class="flex-between mb-1">';
      html += '<div><strong>' + item.subject + '</strong> <span class="text-sm text-dim">' + item.label + '</span></div>';
      html += '<div class="flex-gap">';
      html += '<span class="' + badgeClass + '">' + badgeText + '</span>';
      html += '<button class="btn btn-sm" onclick="SchedulePage.showModal(\'' + item.subject.replace(/'/g,"\\'") + '\')">✏️</button>';
      html += '</div></div>';
      html += '<div class="progress-bar mb-1"><div class="progress-fill ' + progColor + '" style="width:' + pct + '%"></div></div>';
      html += '<div class="flex-between">';
      html += '<span class="text-sm" style="color:var(--accent);font-style:italic">💬 ' + quote + '</span>';
      html += '<span class="text-sm text-dim">📅 ' + item.date + '</span>';
      html += '</div></div>';
    }

    container.innerHTML = html;
  },
};
