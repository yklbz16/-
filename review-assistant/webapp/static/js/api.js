/* API 封装层 */

const API = {
  base: '/api',

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: {},
    };
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      opts.body = body;
    }
    const res = await fetch(this.base + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // Config
  getConfig: () => API.request('GET', '/config'),
  getProviders: () => API.request('GET', '/config/providers'),
  updateConfig: (data) => API.request('PUT', '/config', data),
  testConfig: () => API.request('POST', '/config/test'),

  // Materials
  getMaterials: (subject) => API.request('GET', '/materials' + (subject ? `?subject=${encodeURIComponent(subject)}` : '')),
  uploadMaterial: (subject, file) => {
    const fd = new FormData();
    fd.append('subject', subject);
    fd.append('file', file);
    return API.request('POST', '/materials/upload', fd);
  },
  uploadMaterials: (subject, files) => {
    const fd = new FormData();
    fd.append('subject', subject);
    for (var i = 0; i < files.length; i++) {
      fd.append('files', files[i]);
    }
    return API.request('POST', '/materials/upload', fd);
  },
  addTextMaterial: (subject, content) => API.request('POST', '/materials/text', { subject, content }),
  batchAddText: (entries) => API.request('POST', '/materials/batch-text', { entries }),
  parseMaterial: (subject) => API.request('POST', '/materials/parse', { subject, content: '' }),
  batchParse: (subjects) => API.request('POST', '/materials/batch-parse', { subjects }),
  scanMaterials: () => API.request('POST', '/materials/scan'),
  deleteMaterial: (subject, filename) => API.request('DELETE', `/materials/${encodeURIComponent(subject)}/${encodeURIComponent(filename)}`),

  // Quiz
  generateQuiz: (data) => API.request('POST', '/quiz/generate', data),
  gradeQuiz: (data) => API.request('POST', '/quiz/grade', data),

  // Stream helpers
  generateQuizStreamUrl() { return this.base + '/quiz/generate-stream'; },

  async streamRequest(path, body, onChunk, onDone, onError) {
    try {
      const res = await fetch(this.base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // 检查 HTTP 状态码
      if (!res.ok) {
        var errText = await res.text().catch(function() { return 'HTTP ' + res.status; });
        try {
          var errJson = JSON.parse(errText);
          onError && onError(errJson.detail || errText);
        } catch (e) {
          onError && onError('HTTP ' + res.status + ': ' + errText.slice(0, 200));
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') { onDone && onDone(); return; }
            try {
              const json = JSON.parse(data);
              if (json.error) { onError && onError(json.error); return; }
              onChunk && onChunk(json);
            } catch (e) { /* skip parse errors */ }
          }
        }
      }
      // 流意外结束，没有收到 [DONE]
      if (buffer.trim()) {
        onError && onError('连接意外中断，请重试');
      } else {
        onDone && onDone();
      }
    } catch (e) {
      onError && onError(e.message || '网络请求失败');
    }
  },

  // Errors
  getErrors: (subject, topic) => {
    let q = '';
    if (subject) q += `subject=${encodeURIComponent(subject)}&`;
    if (topic) q += `topic=${encodeURIComponent(topic)}&`;
    return API.request('GET', '/errors' + (q ? '?' + q.slice(0, -1) : ''));
  },
  getErrorStats: () => API.request('GET', '/errors/stats'),
  getErrorDetail: (id) => API.request('GET', `/errors/${id}`),
  reviewErrors: (data) => API.request('POST', '/errors/review', data),
  clearError: (id) => API.request('PUT', `/errors/${id}/clear`),

  // Summaries
  summaryChapter: (subject, chapter) => API.request('POST', '/summary/chapter', { subject, chapter, mode: 'chapter' }),
  summaryMindmap: (subject) => API.request('POST', '/summary/mindmap', { subject, mode: 'mindmap' }),
  summaryCompare: (subject, a, b) => API.request('POST', '/summary/compare', { subject, concept_a: a, concept_b: b, mode: 'compare' }),
  summaryCheatsheet: (subject) => API.request('POST', '/summary/cheatsheet', { subject, mode: 'cheatsheet' }),
  summaryChain: (subject, concept) => API.request('POST', '/summary/chain', { subject, start_concept: concept, mode: 'chain' }),
  summaryGenerateStream: (body) => API.request('POST', '/summary/generate-stream', body),
  summaryStreamUrl: function() { return this.base + '/summary/generate-stream'; },

  // Progress & Schedule
  getProgress: () => API.request('GET', '/progress'),
  setExamDate: (subject, date) => API.request('PUT', '/progress/exam', { subject, exam_date: date }),
  generateSchedule: () => API.request('POST', '/schedule'),
};
