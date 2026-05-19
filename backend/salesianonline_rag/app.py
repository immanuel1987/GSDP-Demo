""" 
GSDP Semantic Search — RAG assistant over multilingual educational content
(PDFs, audio, images, video).

This module can be loaded by ``backend/main.py`` (``mount_rag_ui``) or 
run standalone with ``python app.py``.
"""

import json
import os
import sys
import traceback
from pathlib import Path
from fastapi import APIRouter, FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from markdown_it import MarkdownIt
from pydantic import BaseModel

# ============================================================
# CONFIGURATION
# ============================================================
ENDPOINT_NAME = os.environ.get("VECTOR_SEARCH_ENDPOINT", "multimodal_endpoint")
INDEX_NAME = os.environ.get("VECTOR_SEARCH_INDEX", "salesianonline.gold.vector_content_test_index")
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

DEFAULT_LANG_CODE = "EN"


# ============================================================
# RAG PIPELINE
# ============================================================
_last_query = ""
_last_docs = []
_last_lang_code = DEFAULT_LANG_CODE


def _language_name(lang_code: str) -> str:
    return LANGUAGE_NAMES.get((lang_code or DEFAULT_LANG_CODE).upper(), "English")


def retrieve_context(query, media_filter="All"):
    """Retrieve relevant documents from Vector Search."""
    try:
        vsc = get_vsc()
        index = vsc.get_index(endpoint_name=ENDPOINT_NAME, index_name=INDEX_NAME)

        search_kwargs = {
            "query_text": query,
            "columns": ["title", "file_format", "languages", "url", "content_text"],
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


# ============================================================
# WEB UI (HTML / CSS / JS)
# ============================================================
_PKG_DIR = Path(__file__).resolve().parent
_STATIC_DIR = _PKG_DIR / "static"
_TEMPLATE_PATH = _PKG_DIR / "templates" / "rag.html"
_md = MarkdownIt()


def markdown_to_html(text: str) -> str:
    if not text or not text.strip():
        return ""
    stripped = text.strip()
    if stripped.startswith("<") and any(tag in stripped for tag in ("<div", "<p", "<span")):
        return text
    return _md.render(text)


class QueryRequest(BaseModel):
    query: str
    media_filter: str = "All"
    lang_code: str = DEFAULT_LANG_CODE


class LanguageRequest(BaseModel):
    lang_code: str = DEFAULT_LANG_CODE


def _sse_payload(answer_html: str | None = None, sources_html: str | None = None) -> str:
    data = {}
    if answer_html is not None:
        data["answer_html"] = answer_html
    if sources_html is not None:
        data["sources_html"] = sources_html
    return f"data: {json.dumps(data)}\n\n"


def _chat_events(message: str, media_filter: str, lang_code: str = DEFAULT_LANG_CODE):
    global _last_query, _last_docs, _last_lang_code
    if not message or not message.strip():
        yield _sse_payload("", "")
        return

    yield _sse_payload(LOADING_RETRIEVE, LOADING_RETRIEVE)
    _last_query = message.strip()
    _last_lang_code = (lang_code or DEFAULT_LANG_CODE).upper()
    docs = retrieve_context(message, media_filter=media_filter)
    _last_docs = docs

    if docs and "error" in docs[0]:
        err = f"<p><strong>Retrieval error:</strong> {docs[0]['error']}</p>"
        yield _sse_payload(err, '<div class="sources-empty">No sources available.</div>')
        return

    sources = format_sources(docs)
    yield _sse_payload(LOADING_GENERATE, sources)
    answer = generate_answer(message, docs, language_pref=_language_name(_last_lang_code))
    yield _sse_payload(markdown_to_html(answer), sources)


def _language_events(lang_code: str):
    global _last_query, _last_docs, _last_lang_code
    if not _last_query or not _last_docs:
        yield _sse_payload(
            "<p><em>Ask a question first, then switch languages.</em></p>"
        )
        return
    if _last_docs and "error" in _last_docs[0]:
        yield _sse_payload("<p>No content available to translate.</p>")
        return

    _last_lang_code = (lang_code or DEFAULT_LANG_CODE).upper()
    yield _sse_payload(LOADING_LANGUAGE)
    answer = generate_answer(
        _last_query, _last_docs, language_pref=_language_name(_last_lang_code)
    )
    yield _sse_payload(markdown_to_html(answer))


def mount_rag_ui(fastapi_app: FastAPI, path: str = "/rag") -> None:
    base = path.rstrip("/") or "/rag"
    router = APIRouter(prefix=base, tags=["rag"])

    @router.get("", response_class=HTMLResponse, include_in_schema=False)
    @router.get("/", response_class=HTMLResponse, include_in_schema=False)
    def rag_page():
        html = _TEMPLATE_PATH.read_text(encoding="utf-8")
        html = html.replace("{{GSDP_HOME_URL}}", GSDP_HOME_URL)
        html = html.replace("{{BASE_PATH}}", base)
        return HTMLResponse(html)

    @router.post("/api/query", include_in_schema=False)
    def rag_query(body: QueryRequest):
        def stream():
            for chunk in _chat_events(body.query, body.media_filter, body.lang_code):
                yield chunk

        return StreamingResponse(stream(), media_type="text/event-stream")

    @router.post("/api/language", include_in_schema=False)
    def rag_language(body: LanguageRequest):
        def stream():
            for chunk in _language_events(body.lang_code):
                yield chunk

        return StreamingResponse(stream(), media_type="text/event-stream")

    fastapi_app.include_router(router)
    static_mount = f"{base}/static"
    if not any(getattr(r, "path", None) == static_mount for r in fastapi_app.routes):
        fastapi_app.mount(
            static_mount,
            StaticFiles(directory=str(_STATIC_DIR)),
            name="rag_static",
        )


def mount_rag_gradio(fastapi_app: FastAPI, path: str = "/rag") -> None:
    mount_rag_ui(fastapi_app, path=path)