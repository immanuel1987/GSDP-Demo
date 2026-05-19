(function () {
  const BASE = document.querySelector('meta[name="rag-base"]')?.content || '/rag';

  const queryInput = document.getElementById('query-input');
  const mediaFilter = document.getElementById('media-filter');
  const submitBtn = document.getElementById('submit-btn');
  const clearBtn = document.getElementById('clear-btn');
  const answerOutput = document.getElementById('answer-output');
  const sourcesOutput = document.getElementById('sources-output');
  const langRadios = document.querySelectorAll('input[name="lang"]');

  const PLACEHOLDER_SOURCES =
    '<div class="sources-empty">Sources will appear here after your query&hellip;</div>';

  let busy = false;

  function selectedLangCode() {
    const checked = document.querySelector('input[name="lang"]:checked');
    return checked ? checked.value : 'EN';
  }

  function setBusy(on) {
    busy = on;
    submitBtn.disabled = on;
    clearBtn.disabled = on;
    langRadios.forEach((r) => {
      r.disabled = on;
    });
  }

  function setAnswer(html) {
    answerOutput.classList.remove('answer-placeholder');
    answerOutput.innerHTML = html;
  }

  function setSources(html) {
    sourcesOutput.innerHTML = html;
  }

  async function consumeSse(response, onEvent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch (e) {
          console.warn('SSE parse error', e);
        }
      }
    }
  }

  async function runQuery() {
    const query = queryInput.value.trim();
    if (!query || busy) return;

    setBusy(true);
    try {
      const res = await fetch(`${BASE}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          media_filter: mediaFilter.value,
          lang_code: selectedLangCode(),
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      await consumeSse(res, (data) => {
        if (data.answer_html !== undefined) setAnswer(data.answer_html);
        if (data.sources_html !== undefined) setSources(data.sources_html);
      });
    } catch (err) {
      setAnswer(`<p><strong>Error:</strong> ${escapeHtml(String(err.message || err))}</p>`);
    } finally {
      setBusy(false);
    }
  }

  async function runLanguageSwitch() {
    if (busy) return;

    setBusy(true);
    try {
      const res = await fetch(`${BASE}/api/language`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang_code: selectedLangCode() }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      await consumeSse(res, (data) => {
        if (data.answer_html !== undefined) setAnswer(data.answer_html);
      });
    } catch (err) {
      setAnswer(`<p><strong>Error:</strong> ${escapeHtml(String(err.message || err))}</p>`);
    } finally {
      setBusy(false);
    }
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function clearAll() {
    queryInput.value = '';
    answerOutput.classList.add('answer-placeholder');
    setAnswer(
      '<div class="answer-placeholder">Ask a question above to explore the knowledge base&hellip;</div>'
    );
    setSources(PLACEHOLDER_SOURCES);
  }

  submitBtn.addEventListener('click', runQuery);
  clearBtn.addEventListener('click', clearAll);
  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runQuery();
    }
  });
  langRadios.forEach((radio) => {
    radio.addEventListener('change', runLanguageSwitch);
  });
})();
