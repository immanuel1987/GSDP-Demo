""" 
GSDP Semantic Search — RAG assistant over multilingual educational content
(PDFs, audio, images, video).

This module can be loaded by ``backend/main.py`` (``mount_rag_gradio``) or 
run standalone with ``python app.py``.
"""

import json
import os
import sys
import traceback
import requests as http_requests
import gradio as gr
from fastapi import FastAPI

# ============================================================
# CONFIGURATION
# ============================================================
ENDPOINT_NAME = os.environ.get("VECTOR_SEARCH_ENDPOINT", "multimodal_endpoint")
INDEX_NAME = os.environ.get("VECTOR_SEARCH_INDEX", "salesianonline.gold.vector_content_new_index")
LLM_ENDPOINT = os.environ.get("LLM_ENDPOINT", "databricks-meta-llama-3-3-70b-instruct")
# Browser "Home" from the RAG UI (e.g. frontend URL or "/"). Defaults to site root on the same origin.
GSDP_HOME_URL = os.environ.get("GSDP_HOME_URL", "https://gsdp-dev.cristoerp.com/")

# Get Databricks credentials from environment or use defaults
# In Databricks Apps, these are automatically provided
_host = os.environ.get("DATABRICKS_SERVER_HOSTNAME", "https://dbc-f99975de-9224.cloud.databricks.com")
# Ensure the host has https:// scheme
if not _host.startswith("http://") and not _host.startswith("https://"):
    DATABRICKS_HOST = f"https://{_host}"
else:
    DATABRICKS_HOST = _host

DATABRICKS_TOKEN = os.environ.get("DATABRICKS_ACCESS_TOKEN", "dapia5554ab24c1fa7f53da24f14fb0d7620")


# ============================================================
# AUTHENTICATION
# ============================================================
def get_host():
    """Return the Databricks host with proper URL scheme."""
    return DATABRICKS_HOST


def get_token():
    """Return the personal access token."""
    return DATABRICKS_TOKEN


# ============================================================
# LAZY CLIENT INITIALIZATION
# ============================================================
_vsc = None

def get_vsc():
    global _vsc
    if _vsc is None:
        from databricks.vector_search.client import VectorSearchClient
        _vsc = VectorSearchClient(
            workspace_url=DATABRICKS_HOST,
            personal_access_token=DATABRICKS_TOKEN,
            disable_notice=True
        )
    return _vsc


def get_llm_client():
    from openai import OpenAI
    return OpenAI(
        api_key=DATABRICKS_TOKEN,
        base_url=f"{DATABRICKS_HOST}/serving-endpoints"
    )


# ============================================================
# MEDIA TYPE ICONS
# ============================================================
MEDIA_ICONS = {
    "pdf": "\U0001F4C4",
    "audio": "\U0001F3A7",
    "image": "\U0001F5BC\uFE0F",
    "video": "\U0001F3A5"
}

LANGUAGE_FLAGS = {
    "EN": "\U0001F1EC\U0001F1E7",
    "ES": "\U0001F1EA\U0001F1F8",
    "FR": "\U0001F1EB\U0001F1F7",
    "IT": "\U0001F1EE\U0001F1F9",
    "POR": "\U0001F1E7\U0001F1F7",
    "UNKNOWN": "\U0001F310"
}

LANGUAGE_NAMES = {
    "EN": "English",
    "ES": "Spanish",
    "FR": "French",
    "IT": "Italian",
    "POR": "Portuguese"
}

LANGUAGE_NAME_TO_CODE = {
    "english": "EN",
    "spanish": "ES",
    "french": "FR",
    "italian": "IT",
    "portuguese": "POR",
    "por": "POR",
    "en": "EN",
    "es": "ES",
    "fr": "FR",
    "it": "IT",
}


# ============================================================
# RAG PIPELINE
# ============================================================
_last_query = ""
_last_docs = []


def retrieve_context(query, media_filter="All"):
    """Retrieve relevant documents from Vector Search."""
    try:
        vsc = get_vsc()
        index = vsc.get_index(endpoint_name=ENDPOINT_NAME, index_name=INDEX_NAME)

        search_kwargs = {
            "query_text": query,
            "columns": ["title", "file_format", "language", "url", "content_text"],
            "num_results": 20
        }
        if media_filter and media_filter != "All":
            search_kwargs["filters"] = {"file_format": media_filter.lower()}

        results = index.similarity_search(**search_kwargs)

        documents = []
        for row in results.get("result", {}).get("data_array", []):
            documents.append({
                "file_name": row[0],  # title column mapped to file_name
                "file_format": row[1],
                "language": row[2],
                "url": row[3],
                "content": row[4][:2000] if row[4] else ""
            })
        return documents
    except Exception as e:
        print(f"[ERROR] Retrieval failed: {e}", file=sys.stderr)
        traceback.print_exc()
        return [{"error": str(e)}]


def generate_answer(query, context_docs, language_pref="English"):
    """Generate answer using LLM with retrieved context."""
    context_parts = []
    for i, doc in enumerate(context_docs, 1):
        if "error" in doc:
            continue
        icon = MEDIA_ICONS.get(_normalize_file_format(doc.get("file_format", "")), "")
        context_parts.append(
            f"--- Source {i}: {icon} {doc['file_name']} "
            f"(Type: {doc['file_format']}, Language: {doc['language']}) ---\n"
            f"{doc['content']}")
    context_text = "\n\n".join(context_parts)

    system_prompt = f"""You are a knowledgeable assistant for the Salesian Online educational platform.
Your role is to answer questions about Salesian education content, which includes:
- PDF documents (questionnaires, focus group guides)
- Audio recordings (interviews, lectures in English and French)
- Images (logos, covers)
- Videos (promotional content)

The content spans multiple languages: English, Spanish, French, Italian, and Portuguese.

Rules:
1. Answer in {language_pref}.
2. Base your answer ONLY on the provided context.
3. If the context doesn't contain enough information, say so clearly.
4. Provide a clear, structured summary with key points.
5. Mention which source documents support your answer.
6. Use bullet points for readability.
"""

    user_message = f"""Based on the following retrieved documents, answer this question:

**Question:** {query}

**Retrieved Context:**
{context_text}

Provide a comprehensive yet concise answer with references to the source documents."""

    try:
        client = get_llm_client()
        response = client.chat.completions.create(
            model=LLM_ENDPOINT,
            messages=[{"role": "system", "content": system_prompt},
                     {"role": "user", "content": user_message}],
            max_tokens=1024, temperature=0.3
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[ERROR] LLM failed: {e}", file=sys.stderr)
        traceback.print_exc()
        return f"Error generating response: {str(e)}"


def _parse_languages(lang) -> list[str]:
    """Normalize language field (string, list, or JSON array string) to display names."""
    if lang is None or lang == "":
        return []
    if isinstance(lang, list):
        return [str(x).strip() for x in lang if str(x).strip()]
    text = str(lang).strip()
    if text.startswith("["):
        try:
            parsed = json.loads(text.replace("'", '"'))
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except (json.JSONDecodeError, TypeError):
            pass
    return [text] if text else []


def _language_pills_html(lang) -> str:
    """Build compact language pill markup for a source card."""
    names = _parse_languages(lang)
    if not names:
        return '<span class="src-lang-pill">🌐 Unknown</span>'
    pills = []
    for name in names:
        code = LANGUAGE_NAME_TO_CODE.get(name.lower(), name.upper()[:3])
        flag = LANGUAGE_FLAGS.get(code, "🌐")
        pills.append(f'<span class="src-lang-pill">{flag} {name}</span>')
    return "".join(pills)


def _normalize_file_format(fmt: str) -> str:
    if not fmt:
        return "other"
    f = str(fmt).lower().strip()
    if f in ("ppt", "pptx", "presentation"):
        return "ppt"
    return f


def format_sources(docs):
    """Format source documents as premium HTML cards with clickable file names."""
    if not docs or "error" in docs[0]:
        return '<div class="sources-empty">No sources retrieved.</div>'
    badge_class = {
        "pdf": "src-badge-pdf",
        "audio": "src-badge-audio",
        "image": "src-badge-image",
        "video": "src-badge-video",
        "ppt": "src-badge-ppt",
    }
    cards = ""
    for i, doc in enumerate(docs, 1):
        mtype = _normalize_file_format(doc.get("file_format", ""))
        icon = MEDIA_ICONS.get(mtype, "")
        bclass = badge_class.get(mtype, "src-badge-other")
        
        # Make file name clickable if URL is available
        file_name_html = doc["file_name"]
        if doc.get("url"):
            file_name_html = f'<a href="{doc["url"]}" target="_blank" class="src-file-link">{doc["file_name"]}</a>'
        
        cards += (
            f'<div class="src-card">'
            f'  <div class="src-card-title">{i}. {icon} {file_name_html}</div>'
            f'  <div class="src-card-meta">'
            f'    <span class="src-badge {bclass}">{mtype.upper()}</span>'
            f'    {_language_pills_html(doc.get("language"))}'
            f'  </div>'
            f'</div>'
        )
    return f'<div class="sources-scroll">{cards}</div>'


def _loading_card(title: str, hint: str) -> str:
    return (
        '<div class="rag-premium-load">'
        '<div class="rag-premium-spin" aria-hidden="true"></div>'
        '<div class="rag-premium-load-text">'
        f'<span class="rag-premium-load-title">{title}</span>'
        f'<span class="rag-premium-load-hint">{hint}</span>'
        "</div></div>"
    )


LOADING_RETRIEVE = _loading_card(
    "Retrieving context",
    "Running semantic search on the vector index…",
)
LOADING_GENERATE = _loading_card(
    "Composing your answer",
    "Grounding the response in retrieved sources…",
)
LOADING_LANGUAGE = _loading_card(
    "Updating language",
    "Regenerating the answer in your selected language…",
)


def chat(message, media_filter):
    """Main RAG pipeline: retrieve + generate (with loading states)."""
    global _last_query, _last_docs
    if not message or not message.strip():
        yield "", ""
        return
    yield LOADING_RETRIEVE, LOADING_RETRIEVE
    _last_query = message.strip()
    docs = retrieve_context(message, media_filter=media_filter)
    _last_docs = docs
    if docs and "error" in docs[0]:
        yield f"**Retrieval error:** {docs[0]['error']}", "*No sources available.*"
        return
    sources = format_sources(docs)
    yield LOADING_GENERATE, sources
    answer = generate_answer(message, docs, language_pref="English")
    yield answer, sources


def switch_language(lang_choice):
    """Re-generate the answer in the selected language."""
    global _last_query, _last_docs
    if not _last_query or not _last_docs:
        yield "*Ask a question first, then switch languages.*"
        return
    if _last_docs and "error" in _last_docs[0]:
        yield "No content available to translate."
        return
    lang_map = {
        "\U0001F1EC\U0001F1E7 English": "EN",
        "\U0001F1EA\U0001F1F8 Espa\u00f1ol": "ES",
        "\U0001F1EB\U0001F1F7 Fran\u00e7ais": "FR",
        "\U0001F1EE\U0001F1F9 Italiano": "IT",
        "\U0001F1E7\U0001F1F7 Portugu\u00eas": "POR"
    }
    code = lang_map.get(lang_choice, "EN")
    language_name = LANGUAGE_NAMES.get(code, "English")
    yield LOADING_LANGUAGE
    yield generate_answer(_last_query, _last_docs, language_pref=language_name)


# ============================================================
# GRADIO UI
# ============================================================
CUSTOM_CSS = """
/* ============================================================
   GSDP Semantic Search — Premium UI
   ============================================================ */

/* Hide Gradio built-in footer */
.gradio-container > .wrap > .contain > footer,
.gradio-container footer { display: none !important; }

/* ── Remove all scrollbars ── */
*,
*::before,
*::after {
    scrollbar-width: none !important;   /* Firefox */
    -ms-overflow-style: none !important; /* IE / Edge */
}
*::-webkit-scrollbar {
    display: none !important;           /* Chrome / Safari / Gradio iframe */
    width: 0 !important;
    height: 0 !important;
}

/* ── Base container ── */
.gradio-container {
    --blue-900: #051a30;
    --blue-800: #082f4d;
    --blue-700: #0c3d6b;
    --blue-600: #004a99;
    --blue-500: #1f6eb8;
    --blue-400: #4a9fd4;
    --blue-100: #daeaf8;
    --blue-50:  #eef4fc;
    --surface:  #ffffff;
    --surface-2: #f5f8fd;
    --border:   #d0dff0;
    --border-2: #bccfe8;
    --ink:      #0f2744;
    --ink-muted:#4a6b8c;
    --shadow-sm: 0 1px 3px rgba(8,28,56,.07), 0 1px 2px rgba(8,28,56,.04);
    --shadow-md: 0 4px 16px -2px rgba(8,28,56,.10), 0 2px 6px -1px rgba(8,28,56,.06);
    --shadow-lg: 0 12px 40px -8px rgba(0,74,153,.18), 0 4px 12px -2px rgba(8,28,56,.08);
    --radius-sm: 10px;
    --radius-md: 14px;
    --radius-lg: 20px;

    --body-background-fill: var(--blue-50) !important;
    --background-fill-primary: var(--surface) !important;
    --background-fill-secondary: var(--surface-2) !important;
    --border-color-primary: var(--border) !important;
    --body-text-color: var(--ink) !important;
    --block-label-text-color: var(--blue-800) !important;
    --block-title-text-color: var(--blue-800) !important;
    --input-background-fill: var(--surface) !important;
    --input-border-color: var(--border-2) !important;
    --button-primary-background-fill: var(--blue-600) !important;
    --button-primary-text-color: #ffffff !important;
    color-scheme: light !important;

    max-width: 100% !important;
    margin: 0 !important;
    min-height: 100vh;
    padding: 0 !important;
    font-family: "Source Sans 3", "Inter", ui-sans-serif, system-ui, "Segoe UI", sans-serif !important;
    background:
        radial-gradient(ellipse 130% 60% at 50% -10%, rgba(31,110,184,.13) 0%, transparent 60%),
        radial-gradient(ellipse 80%  40% at 95%  10%, rgba(0,74,153,.07)  0%, transparent 50%),
        linear-gradient(170deg, #e8f2fc 0%, #eef4fc 40%, #f3f7fd 100%) !important;
    color: var(--ink) !important;
}

.gradio-container .wrap,
.gradio-container .contain,
.gradio-container main { color: var(--ink) !important; }
.gradio-container .panel { background: transparent !important; }

/* ── Page wrapper ── */
.page-wrap {
    max-width: 1240px !important;
    margin: 0 auto !important;
    padding: 0 1.5rem 2.5rem !important;
}


/* ── Top nav bar ── */
.top-nav-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 1.75rem;
    background: rgba(255,255,255,.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 6px rgba(8,28,56,.05);
    width: 100%;
    box-sizing: border-box;
}
.top-nav-home {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--blue-800);
    text-decoration: none;
    padding: 0.35rem 0.9rem;
    border-radius: 8px;
    border: 1.5px solid var(--border-2);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    transition: all .15s ease;
    white-space: nowrap;
}
.top-nav-home:hover {
    background: var(--blue-50);
    border-color: var(--blue-400);
    color: var(--blue-600);
    text-decoration: none;
}
.top-nav-brand {
    font-weight: 700;
    font-size: 0.88rem;
    color: var(--blue-600);
    letter-spacing: .01em;
    white-space: nowrap;
}

/* ── Hero header ── */
.header-section {
    position: relative !important;
    background: linear-gradient(118deg, #061526 0%, #0a2d54 30%, #093368 55%, #0d4a8f 80%, #004a99 100%) !important;
    padding: 1.4rem 2rem 1.3rem !important;
    border-radius: var(--radius-lg) !important;
    margin: 0.75rem 1.5rem 1.25rem !important;
    border: none !important;
    box-shadow: 0 6px 24px -4px rgba(0,74,153,.30), 0 2px 6px rgba(8,28,56,.15) !important;
}


/* dot-grid texture */
.header-section::after {
    content: "" !important;
    position: absolute !important;
    inset: 0 !important;
    background-image: radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px) !important;
    background-size: 22px 22px !important;
    pointer-events: none !important;
}

.header-section > * { position: relative !important; z-index: 1 !important; }

/* hero inner wrapper — centers everything */
.hero-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    width: 100%;
}

/* Home link row — sits above the title */
.hero-home-row {
    width: 100%;
    display: flex;
    justify-content: flex-start;
    margin-bottom: 0.6rem;
}
.hero-home-link {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    font-weight: 600;
    font-size: 0.82rem;
    color: rgba(220,238,255,.95);
    text-decoration: none;
    padding: 0.3rem 0.85rem;
    border-radius: 99px;
    border: 1.5px solid rgba(255,255,255,.3);
    background: rgba(255,255,255,.12);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: all .18s ease;
    white-space: nowrap;
}
.hero-home-link:hover {
    background: rgba(255,255,255,.22);
    border-color: rgba(255,255,255,.6);
    color: #ffffff;
    text-decoration: none;
}

.hero-title {
    color: #ffffff !important;
    font-size: 1.55rem !important;
    font-weight: 800 !important;
    letter-spacing: -0.025em !important;
    line-height: 1.2 !important;
    margin: 0 0 0.35rem !important;
    text-shadow: 0 2px 10px rgba(0,0,0,.22) !important;
}
.hero-desc {
    color: rgba(210,230,255,.88) !important;
    font-size: 0.9rem !important;
    margin: 0 !important;
    max-width: 46rem !important;
    line-height: 1.55 !important;
}

/* override old h1/p inside header-section if Gradio injects them */
.header-section h1 {
    color: #ffffff !important;
    font-size: 1.55rem !important;
    font-weight: 800 !important;
    letter-spacing: -0.025em !important;
    line-height: 1.2 !important;
    margin: 0 !important;
    text-shadow: 0 2px 10px rgba(0,0,0,.22) !important;
    text-align: center !important;
}
.header-section p {
    color: rgba(210,230,255,.88) !important;
    font-size: 0.9rem !important;
    margin-top: 0.3rem !important;
    max-width: 50rem !important;
    line-height: 1.55 !important;
    text-align: center !important;
}

/* badge strip */
.header-badges {
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
    gap: 0.35rem !important;
    margin-top: 0.7rem !important;
}
.hbadge {
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.25rem !important;
    padding: 0.18rem 0.55rem !important;
    border-radius: 99px !important;
    background: rgba(255,255,255,.12) !important;
    border: 1px solid rgba(255,255,255,.2) !important;
    color: rgba(220,238,255,.92) !important;
    font-size: 0.72rem !important;
    font-weight: 600 !important;
    backdrop-filter: blur(6px) !important;
    letter-spacing: .01em !important;
}

/* ── Search card ── */
.search-card {
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    border-radius: var(--radius-md) !important;
    padding: 1.2rem 1.4rem !important;
    margin: 0 1.5rem 1rem !important;
    box-shadow: var(--shadow-md) !important;
}

/* ── Toolbar row (media + language) ── */
.toolbar-row {
    background: linear-gradient(180deg, #fff 0%, var(--surface-2) 100%) !important;
    border: 1px solid var(--border) !important;
    padding: 0.8rem 1.2rem !important;
    border-radius: var(--radius-md) !important;
    margin: 0 1.5rem 1.1rem !important;
    box-shadow: var(--shadow-sm) !important;
    align-items: center !important;
}

/* ── Side-inset utility (matches hero/search margins) ── */
.content-row,
.side-inset {
    margin-left: 1.5rem !important;
    margin-right: 1.5rem !important;
}

/* ── Labels ── */
.gradio-container .label-wrap label,
.gradio-container label span {
    color: var(--blue-800) !important;
    font-weight: 600 !important;
    font-size: 0.82rem !important;
    letter-spacing: .02em !important;
    text-transform: uppercase !important;
}

/* ── Inputs & textareas ── */
.gradio-container textarea,
.gradio-container input:not([type="checkbox"]):not([type="radio"]) {
    background: var(--surface) !important;
    color: var(--ink) !important;
    border: 1.5px solid var(--border-2) !important;
    border-radius: var(--radius-sm) !important;
    box-shadow: var(--shadow-sm) !important;
    font-size: 1rem !important;
    transition: border-color .15s, box-shadow .15s !important;
}
.gradio-container textarea:focus,
.gradio-container input:focus {
    border-color: var(--blue-600) !important;
    box-shadow: 0 0 0 3px rgba(0,74,153,.14) !important;
    outline: none !important;
}

/* ── Dropdown ── */
.gradio-container .wrap_inner,
.gradio-container [class*="dropdown"] { color: var(--ink) !important; }
.gradio-container .options,
.gradio-container ul.options,
.gradio-container .options-wrap {
    background: var(--surface) !important;
    border: 1px solid var(--border-2) !important;
    border-radius: var(--radius-sm) !important;
    box-shadow: 0 12px 40px -8px rgba(8,28,56,.18) !important;
}

/* ── Radio (language) ── */
.gradio-container input[type="radio"],
.gradio-container input[type="checkbox"] { accent-color: var(--blue-600) !important; }
.gradio-container .radio-group,
.gradio-container fieldset { border-color: transparent !important; }

/* ── Buttons ── */
.gradio-container button.primary,
.gradio-container .lg.primary {
    background: linear-gradient(160deg, #2178c4 0%, #004a99 60%, #003a7a 100%) !important;
    color: #ffffff !important;
    border: 1px solid rgba(0,58,122,.6) !important;
    border-radius: var(--radius-sm) !important;
    font-weight: 700 !important;
    letter-spacing: .01em !important;
    box-shadow: 0 4px 14px rgba(0,74,153,.30), 0 1px 3px rgba(0,74,153,.2) !important;
    transition: all .2s ease !important;
}
.gradio-container button.primary:hover,
.gradio-container .lg.primary:hover {
    background: linear-gradient(160deg, #004a99 0%, #003a7a 100%) !important;
    box-shadow: 0 6px 20px rgba(0,74,153,.38) !important;
    transform: translateY(-1px) !important;
}
.gradio-container button.secondary {
    background: var(--surface) !important;
    color: var(--blue-800) !important;
    border: 1.5px solid var(--border-2) !important;
    border-radius: var(--radius-sm) !important;
    font-weight: 600 !important;
    box-shadow: var(--shadow-sm) !important;
    transition: all .15s !important;
}
.gradio-container button.secondary:hover {
    background: var(--blue-50) !important;
    border-color: var(--blue-400) !important;
}

/* ── Answer card ── */
.chat-area {
    border: 1.5px solid var(--border) !important;
    border-radius: var(--radius-md) !important;
    padding: 1.5rem 1.6rem !important;
    background: var(--surface) !important;
    min-height: 220px !important;
    box-shadow: var(--shadow-md) !important;
    font-size: 1rem !important;
    line-height: 1.7 !important;
}
.chat-area .prose,
.chat-area p,
.chat-area li { color: #1a1a2e !important; }
.chat-area a { color: var(--blue-600) !important; text-decoration: underline !important; }
.chat-area h1, .chat-area h2, .chat-area h3 {
    color: var(--blue-800) !important;
    font-weight: 700 !important;
}

/* ── Content columns ── */
.answer-column,
.sources-column {
    display: flex !important;
    flex-direction: column !important;
    gap: 0.5rem !important;
    min-width: 0 !important;
}

.sources-panel-card {
    background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%) !important;
    border: 1.5px solid var(--border) !important;
    border-radius: var(--radius-md) !important;
    padding: 1rem 1rem 1.1rem !important;
    box-shadow: var(--shadow-md) !important;
    flex: 1 1 auto !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
}

.sources-list,
.gradio-container .sources-list {
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
    min-height: 0 !important;
}

.sources-scroll {
    max-height: min(520px, 65vh);
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 2px;
}

.sources-empty {
    color: var(--ink-muted);
    font-size: 0.88rem;
    padding: 0.5rem 0;
}

.sources-panel-card a,
.sources-list a { color: var(--blue-600) !important; }

/* Source cards rendered in markdown */
.src-card {
    display: flex !important;
    flex-direction: column !important;
    gap: 0.3rem !important;
    padding: 0.72rem 0.85rem !important;
    margin-bottom: 0.55rem !important;
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    border-left: 3px solid var(--blue-500) !important;
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0 !important;
    box-shadow: var(--shadow-sm) !important;
    transition: box-shadow .15s !important;
}
.src-card:hover { box-shadow: var(--shadow-md) !important; }
.src-card-title {
    font-weight: 700 !important;
    color: var(--blue-800) !important;
    font-size: 0.88rem !important;
    word-break: break-word !important;
}
.src-card-meta {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 0.35rem !important;
    font-size: 0.76rem !important;
    color: var(--ink-muted) !important;
}
.src-badge {
    display: inline-flex !important;
    align-items: center !important;
    padding: 0.1rem 0.5rem !important;
    border-radius: 99px !important;
    font-weight: 600 !important;
    font-size: 0.72rem !important;
    letter-spacing: .02em !important;
}
.src-badge-pdf   { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.src-badge-audio { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.src-badge-image { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }
.src-badge-video { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
.src-badge-other { background: var(--blue-50); color: var(--blue-600); border: 1px solid var(--blue-100); }
.src-badge-ppt   { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }

.src-lang-pill {
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.15rem !important;
    padding: 0.12rem 0.45rem !important;
    border-radius: 99px !important;
    background: var(--blue-50) !important;
    border: 1px solid var(--blue-100) !important;
    color: var(--ink-muted) !important;
    font-size: 0.7rem !important;
    font-weight: 600 !important;
    white-space: nowrap !important;
}

/* Clickable file name link */
.src-file-link {
    color: var(--blue-600) !important;
    text-decoration: none !important;
    transition: all .15s ease !important;
}
.src-file-link:hover {
    color: var(--blue-700) !important;
    text-decoration: underline !important;
}

/* ── Accordion ── */
.gradio-container .rag-accordion {
    background: var(--surface) !important;
    border: 1.5px solid var(--border) !important;
    border-radius: var(--radius-md) !important;
    overflow: visible !important;
    box-shadow: var(--shadow-sm) !important;
    margin-top: 0.5rem !important;
}
.gradio-container .rag-accordion .label-wrap {
    color: var(--blue-800) !important;
    font-weight: 700 !important;
    padding: 0.9rem 1.1rem !important;
    background: linear-gradient(90deg, var(--blue-50) 0%, var(--surface) 100%) !important;
    border-radius: calc(var(--radius-md) - 2px) !important;
    width: 100% !important;
    font-size: 0.9rem !important;
    letter-spacing: .01em !important;
}
.gradio-container .rag-accordion .label-wrap .icon { color: var(--blue-600) !important; opacity: 1 !important; }
.gradio-container .rag-accordion table,
.gradio-container .rag-accordion th,
.gradio-container .rag-accordion td {
    color: var(--ink) !important;
    background: var(--surface) !important;
    border-color: var(--border) !important;
}
.gradio-container .rag-accordion tbody tr:hover td {
    background: var(--blue-50) !important;
    cursor: pointer !important;
}
.gradio-container .rag-accordion .label-wrap + div { padding: 0 0.5rem 0.75rem !important; }

/* ── Details / summary ── */
.gradio-container details {
    background: var(--surface) !important;
    border: 1px solid var(--border-2) !important;
    border-radius: var(--radius-md) !important;
    overflow: hidden;
    box-shadow: var(--shadow-sm) !important;
}
.gradio-container details > summary {
    color: var(--blue-800) !important;
    font-weight: 600 !important;
    padding: 0.75rem 1rem !important;
    background: linear-gradient(90deg, var(--blue-50) 0%, var(--surface) 100%) !important;
}
.gradio-container details[open] > summary { border-bottom: 1px solid var(--border) !important; }

/* ── Section heading chips ── */
.section-chip {
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.35rem !important;
    padding: 0.22rem 0.7rem !important;
    border-radius: 99px !important;
    background: var(--blue-50) !important;
    border: 1px solid var(--blue-100) !important;
    color: var(--blue-600) !important;
    font-size: 0.75rem !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: .04em !important;
    margin-bottom: 0.5rem !important;
}

/* ── Divider ── */
.rag-divider {
    border: none !important;
    border-top: 1px solid var(--border) !important;
    margin: 1.25rem 0 !important;
}

/* ── Footer ── */
.footer {
    text-align: center !important;
    color: var(--ink-muted) !important;
    padding: 1.2rem 1rem 0.5rem !important;
    font-size: 0.79rem !important;
    border-top: 1px solid var(--border) !important;
    margin: 1rem 1.5rem 0 !important;
    letter-spacing: .01em !important;
}
.footer-logo {
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.4rem !important;
    font-weight: 700 !important;
    color: var(--blue-600) !important;
    margin-bottom: 0.2rem !important;
}
.footer-sub { color: var(--ink-muted) !important; opacity: .8 !important; }

/* ── Loading card ── */
@keyframes rag-premium-spin { to { transform: rotate(360deg); } }

.rag-premium-load {
    display: flex !important;
    align-items: center !important;
    gap: 1rem !important;
    padding: 1.4rem 1.3rem !important;
    background: linear-gradient(135deg, var(--surface) 0%, var(--blue-50) 100%) !important;
    border: 1.5px solid var(--border) !important;
    border-radius: var(--radius-md) !important;
    box-shadow: var(--shadow-md) !important;
}
.rag-premium-spin {
    width: 40px !important;
    height: 40px !important;
    flex-shrink: 0 !important;
    border-radius: 50% !important;
    border: 3px solid var(--blue-100) !important;
    border-top-color: var(--blue-600) !important;
    border-right-color: var(--blue-500) !important;
    animation: rag-premium-spin 0.68s linear infinite !important;
}
.rag-premium-load-text { display: flex !important; flex-direction: column !important; gap: 0.12rem !important; }
.rag-premium-load-title { font-weight: 700 !important; font-size: 1.02rem !important; color: var(--blue-800) !important; }
.rag-premium-load-hint  { font-size: 0.88rem !important; color: var(--ink-muted) !important; line-height: 1.45 !important; }

.progress-bar-wrap,
.generating { border-radius: 8px !important; }

/* ============================================================
   RESPONSIVE — Tablet  (641 px – 1024 px)
   ============================================================ */
@media (max-width: 1024px) {
    .top-nav-bar   { padding: 0.6rem 1.25rem; }
    .top-nav-home  { font-size: 0.84rem; padding: 0.3rem 0.75rem; }
    .top-nav-brand { font-size: 0.84rem; }

    .header-section {
        margin: 0.6rem 1rem 1.1rem !important;
        padding: 1.1rem 1.5rem 1rem !important;
    }
    .hero-title        { font-size: 1.35rem !important; }
    .header-section h1 { font-size: 1.35rem !important; }
    .search-card  { margin: 0 1rem 0.9rem !important; padding: 1rem 1.1rem !important; }
    .toolbar-row  { margin: 0 1rem 1rem !important; padding: 0.7rem 1rem !important; }
    .content-row,
    .side-inset   { margin-left: 1rem !important; margin-right: 1rem !important; }
    .footer       { margin: 0.9rem 1rem 0 !important; }
}

/* ============================================================
   RESPONSIVE — Mobile  (≤ 640 px)
   ============================================================ */
@media (max-width: 640px) {

    /* Nav bar — mobile */
    .top-nav-bar {
        padding: 0.5rem 0.9rem;
        gap: 0.4rem;
    }
    .top-nav-home {
        font-size: 0.78rem;
        padding: 0.28rem 0.65rem;
        border-radius: 7px;
    }
    .top-nav-brand { font-size: 0.76rem; }

    /* Hero */
    .header-section {
        margin: 0.4rem 0.6rem 0.85rem !important;
        padding: 1rem 0.9rem 0.95rem !important;
        border-radius: var(--radius-md) !important;
    }
    .hero-title        { font-size: 1.15rem !important; letter-spacing: -0.01em !important; }
    .hero-desc         { font-size: 0.82rem !important; }
    .header-section h1 { font-size: 1.15rem !important; }
    .header-section p  { font-size: 0.82rem !important; }
    .header-badges     { gap: 0.3rem !important; margin-top: 0.75rem !important; }
    .hbadge            { font-size: 0.7rem !important; padding: 0.2rem 0.5rem !important; }
    .hero-home-link    { font-size: 0.75rem !important; padding: 0.25rem 0.6rem !important; }

    /* Search card */
    .search-card {
        margin: 0 0.6rem 0.75rem !important;
        padding: 0.85rem 0.85rem !important;
        border-radius: var(--radius-sm) !important;
    }

    /* Search buttons — full-width stack */
    .gradio-container button.primary,
    .gradio-container .lg.primary,
    .gradio-container button.secondary {
        width: 100% !important;
        min-width: 0 !important;
    }

    /* Toolbar — stack dropdown above radio */
    .toolbar-row {
        margin: 0 0.6rem 0.75rem !important;
        padding: 0.7rem 0.85rem !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 0.7rem !important;
    }

    /* Radio — wrap tightly */
    .gradio-container .radio-group { flex-wrap: wrap !important; gap: 0.3rem !important; }
    .gradio-container .radio-group label {
        flex: 0 0 auto !important;
        font-size: 0.78rem !important;
    }

    /* Content — stack answer above sources */
    .content-row {
        flex-direction: column !important;
        margin-left: 0.6rem !important;
        margin-right: 0.6rem !important;
    }
    .content-row > * { width: 100% !important; min-width: 0 !important; flex: none !important; }

    .chat-area {
        padding: 1rem !important;
        min-height: 150px !important;
        border-radius: var(--radius-sm) !important;
    }
    .sources-panel-card {
        border-radius: var(--radius-sm) !important;
        padding: 0.85rem 0.9rem 1rem !important;
        margin-top: 0 !important;
    }
    .sources-scroll {
        max-height: min(360px, 50vh);
    }

    .side-inset { margin-left: 0.6rem !important; margin-right: 0.6rem !important; }
    .footer     { margin: 0.8rem 0.6rem 0 !important; font-size: 0.73rem !important; }

    .gradio-container textarea { font-size: 0.94rem !important; }
}
"""


def create_app():
    """Build the Gradio application."""
    _theme = gr.themes.Soft(
        primary_hue=gr.themes.colors.blue,
        secondary_hue=gr.themes.colors.blue,
        neutral_hue=gr.themes.colors.slate,
        font=[gr.themes.GoogleFont("Source Sans 3"), "Inter", "ui-sans-serif", "sans-serif"],
        radius_size=gr.themes.sizes.radius_lg,
    )
    try:
        _theme = _theme.set(
            body_background_fill="#eef4fc",
            block_background_fill="#ffffff",
            block_border_color="#d0dff0",
            block_title_text_color="#082f4d",
            block_label_text_color="#082f4d",
            input_background_fill="#ffffff",
            button_primary_background_fill="#004a99",
            button_primary_text_color="#ffffff",
        )
    except (TypeError, AttributeError):
        pass

    with gr.Blocks(
        css=CUSTOM_CSS,
        title="GSDP Semantic Search",
        theme=_theme,
    ) as app:



        # ── Hero header ─────────────────────────────────────
        with gr.Column(elem_classes="header-section"):
            gr.HTML(
                f"<div class='hero-inner'>"
                f"<div class='hero-home-row'>"
                f"<a href='{GSDP_HOME_URL}' class='hero-home-link'>&#8592; Home</a>"
                f"</div>"
                f"<h1 class='hero-title'>Global Salesian Digital Platform Semantic Search</h1>"
                f"<p class='hero-desc'>AI-powered search and Q&amp;A over the Salesian multilingual knowledge base &mdash; "
                f"PDFs, audio recordings, images, and video content across five languages.</p>"
                f"<div class='header-badges'>"
                f"<span class='hbadge'>&#128196; PDF Documents</span>"
                f"<span class='hbadge'>&#127911; Audio</span>"
                f"<span class='hbadge'>&#128444;&#65039; Images</span>"
                f"<span class='hbadge'>&#127909; Video</span>"
                f"<span class='hbadge'>&#127760; 5 Languages</span>"
                f"</div>"
                f"</div>"
            )
   

        # ── Search card ─────────────────────────────────────
        with gr.Column(elem_classes="search-card"):
            query_input = gr.Textbox(
                placeholder="\U0001F50E  Ask anything — e.g., What is the Preventive System methodology?",
                label="Your question",
                lines=2,
                max_lines=5,
            )
            with gr.Row():
                submit_btn = gr.Button(
                    "\u2728  Search & Analyze",
                    variant="primary",
                    elem_classes="primary-btn",
                    scale=3,
                )
                clear_btn = gr.Button("\u2715  Clear", variant="secondary", scale=1)

        # ── Toolbar: media filter + language ────────────────
        with gr.Row(elem_classes="toolbar-row"):
            media_filter = gr.Dropdown(
                choices=["All", "PDF", "Audio", "Image", "Video"],
                value="All",
                label="Filter by media type",
                scale=1,
            )
            lang_radio = gr.Radio(
                choices=[
                    "\U0001F1EC\U0001F1E7 English",
                    "\U0001F1EA\U0001F1F8 Espa\u00f1ol",
                    "\U0001F1EB\U0001F1F7 Fran\u00e7ais",
                    "\U0001F1EE\U0001F1F9 Italiano",
                    "\U0001F1E7\U0001F1F7 Portugu\u00eas",
                ],
                value="\U0001F1EC\U0001F1E7 English",
                label="Response language",
                interactive=True,
                scale=3,
            )

        # ── Content: answer + sources ────────────────────────
        with gr.Row(elem_classes="content-row"):
            with gr.Column(scale=3, elem_classes="answer-column"):
                gr.Markdown(
                    "<div class='section-chip'>\U0001F4AC Answer</div>",
                    sanitize_html=False,
                )
                answer_output = gr.Markdown(
                    value=(
                        "<div style='color:#4a6b8c;font-size:.95rem;padding:.25rem 0;'>"
                        "Ask a question above to explore the knowledge base\u2026"
                        "</div>"
                    ),
                    label="",
                    elem_classes="chat-area",
                    sanitize_html=False,
                )

            with gr.Column(scale=1, elem_classes="sources-column"):
                gr.Markdown(
                    "<div class='section-chip'>\U0001F4DA Retrieved Sources</div>",
                    sanitize_html=False,
                )
                with gr.Column(elem_classes="sources-panel-card"):
                    sources_output = gr.Markdown(
                        value=(
                            "<div class='sources-empty'>"
                            "Sources will appear here after your query\u2026"
                            "</div>"
                        ),
                        elem_classes="sources-list",
                        sanitize_html=False,
                    )

        # ── Example questions accordion ──────────────────────
        # with gr.Accordion(
        #     "\U0001F4A1  Example questions — click any to get started",
        #     open=True,
        #     elem_classes=["rag-accordion", "side-inset"],
        # ):
        #     gr.Examples(
        #         examples=[[q] for q in EXAMPLE_QUERIES],
        #         inputs=query_input,
        #         label="",
        #     )

        # ── Footer ──────────────────────────────────────────
        gr.Markdown(
            "<div class='footer'>"
            "<div class='footer-logo'>\U0001F30D&nbsp; Global Salesian Digital Platform Semantic Search</div>"
            "<div class='footer-sub'>"
            "Powered by <strong>Bosco Soft Technologies Pvt Ltd</strong> &nbsp;&middot;&nbsp; "
            "Multilingual Salesian Knowledge Corpus &nbsp;&middot;&nbsp; "
            "</div>"
            "</div>",
            sanitize_html=False,
        )

        # ── Event wiring ────────────────────────────────────
        submit_btn.click(
            fn=chat,
            inputs=[query_input, media_filter],
            outputs=[answer_output, sources_output],
            show_progress="hidden",
        )
        query_input.submit(
            fn=chat,
            inputs=[query_input, media_filter],
            outputs=[answer_output, sources_output],
            show_progress="hidden",
        )
        lang_radio.change(
            fn=switch_language,
            inputs=[lang_radio],
            outputs=[answer_output],
            show_progress="hidden",
        )
        clear_btn.click(
            fn=lambda: (
                "",
                "<div style='color:#4a6b8c;font-size:.95rem;padding:.25rem 0;'>"
                "Ask a question above to explore the knowledge base\u2026</div>",
                "<div class='sources-empty'>"
                "Sources will appear here after your query\u2026</div>",
            ),
            outputs=[query_input, answer_output, sources_output],
        )

    app.show_api = False
    return app


def mount_rag_gradio(fastapi_app: FastAPI, path: str = "/rag") -> None:
    """Wire the RAG Gradio UI onto the main FastAPI app.

    Call this once from ``main.py`` when the API starts.
    """
    gr.mount_gradio_app(fastapi_app, create_app(), path=path)


# ============================================================
# STANDALONE LAUNCH
# ============================================================
# if __name__ == "__main__":
#     # Launch Gradio app directly when run as standalone script
#     # For Databricks Apps, use port 8080
#     port = int(os.environ.get("PORT", 8080))
#     print(f"Starting GSDP Semantic Search on port {port}...")
#     app = create_app()
#     app.launch(
#         server_name="0.0.0.0",
#         server_port=port,
#         share=False
#     )
