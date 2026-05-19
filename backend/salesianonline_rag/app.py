""" 
GSDP Semantic Search — RAG assistant over multilingual educational content
(PDFs, audio, images, video).

This module can be loaded by ``backend/main.py`` (``mount_rag_ui``) or 
run standalone with ``python app.py``.
"""

import html
import json
import os
import re
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
    "doc": "\U0001F4DD",
    "audio": "\U0001F3A7",
    "image": "\U0001F5BC\uFE0F",
    "video": "\U0001F3A5",
    "ppt": "\U0001F4CA",
    "sheet": "\U0001F4CA",
    "other": "\U0001F4CE",
}

RETRIEVAL_TOP_K = 25
RETRIEVAL_TOP_K_FILTERED = 60
MAX_SOURCES_RETURNED = 20
CONTENT_CHARS_PER_DOC = int(os.environ.get("RAG_CONTENT_CHARS", "4000"))
MAX_ANSWER_TOKENS = int(os.environ.get("RAG_MAX_ANSWER_TOKENS", "2048"))

# UI dropdown value -> normalized category (see _normalize_file_format)
MEDIA_FILTER_CATEGORIES = {
    "PDF": "pdf",
    "Audio": "audio",
    "Image": "image",
    "Video": "video",
    "Document": "doc",
    "Presentation": "ppt",
}

# Possible raw file_format values in the index (server-side filter is best-effort)
MEDIA_FILTER_SERVER_VALUES = {
    "PDF": ["pdf", "PDF"],
    "Audio": ["audio", "Audio", "AUDIO", "mp3", "wav", "ogg", "m4a", "mpeg"],
    "Image": ["image", "Image", "IMAGE", "img", "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"],
    "Video": ["video", "Video", "VIDEO", "mp4", "mov", "avi", "mkv", "webm"],
    "Document": ["doc", "docx", "word", "document", "Document", "rtf", "odt"],
    "Presentation": ["ppt", "pptx", "presentation", "Presentation", "odp"],
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

SOURCE_REF_LABELS = {
    "EN": "Source",
    "ES": "Fuente",
    "FR": "Source",
    "IT": "Fonte",
    "POR": "Fonte",
}

OPEN_RESOURCE_LABELS = {
    "EN": {
        "pdf": "Open PDF", "doc": "Open document", "audio": "Open audio",
        "image": "Open image", "video": "Open video", "ppt": "Open presentation",
        "sheet": "Open spreadsheet", "other": "Open file",
    },
    "ES": {
        "pdf": "Abrir PDF", "doc": "Abrir documento", "audio": "Abrir audio",
        "image": "Abrir imagen", "video": "Abrir video", "ppt": "Abrir presentación",
        "sheet": "Abrir hoja de cálculo", "other": "Abrir archivo",
    },
    "FR": {
        "pdf": "Ouvrir le PDF", "doc": "Ouvrir le document", "audio": "Ouvrir l'audio",
        "image": "Ouvrir l'image", "video": "Ouvrir la vidéo", "ppt": "Ouvrir la présentation",
        "sheet": "Ouvrir la feuille de calcul", "other": "Ouvrir le fichier",
    },
    "IT": {
        "pdf": "Apri PDF", "doc": "Apri documento", "audio": "Apri audio",
        "image": "Apri immagine", "video": "Apri video", "ppt": "Apri presentazione",
        "sheet": "Apri foglio di calcolo", "other": "Apri file",
    },
    "POR": {
        "pdf": "Abrir PDF", "doc": "Abrir documento", "audio": "Abrir áudio",
        "image": "Abrir imagem", "video": "Abrir vídeo", "ppt": "Abrir apresentação",
        "sheet": "Abrir folha de cálculo", "other": "Abrir ficheiro",
    },
}

REFERENCES_HEADINGS = {
    "EN": "References",
    "ES": "Referencias",
    "FR": "Références",
    "IT": "Riferimenti",
    "POR": "Referências",
}

UI_SECTION_LABELS = {
    "EN": {"sources": "Retrieved Sources", "answer": "Answer"},
    "ES": {"sources": "Fuentes recuperadas", "answer": "Respuesta"},
    "FR": {"sources": "Sources récupérées", "answer": "Réponse"},
    "IT": {"sources": "Fonti recuperate", "answer": "Risposta"},
    "POR": {"sources": "Fontes recuperadas", "answer": "Resposta"},
}


# ============================================================
# RAG PIPELINE
# ============================================================
_last_query = ""
_last_docs = []
_last_lang_code = DEFAULT_LANG_CODE
_last_media_filter = "All"


def _language_name(lang_code: str) -> str:
    return LANGUAGE_NAMES.get((lang_code or DEFAULT_LANG_CODE).upper(), "English")


def _matches_media_filter(file_format: str, media_filter: str) -> bool:
    """Match UI media filter against index file_format using normalized categories."""
    if not media_filter or media_filter == "All":
        return True
    category = MEDIA_FILTER_CATEGORIES.get(media_filter)
    if not category:
        return True
    return _normalize_file_format(file_format) == category


def _rows_to_documents(rows) -> list[dict]:
    documents = []
    for row in rows:
        documents.append({
            "file_name": row[0],
            "file_format": row[1],
            "language": row[2],
            "url": row[3],
            "content": (row[4] or "")[:CONTENT_CHARS_PER_DOC],
        })
    return documents


def _filter_documents_by_media(documents: list[dict], media_filter: str) -> list[dict]:
    if not media_filter or media_filter == "All":
        return documents[:MAX_SOURCES_RETURNED]
    filtered = [d for d in documents if _matches_media_filter(d.get("file_format", ""), media_filter)]
    return filtered[:MAX_SOURCES_RETURNED]


def retrieve_context(query, media_filter="All"):
    """Retrieve relevant documents from Vector Search with reliable media-type filtering."""
    try:
        vsc = get_vsc()
        index = vsc.get_index(endpoint_name=ENDPOINT_NAME, index_name=INDEX_NAME)

        use_filter = media_filter and media_filter != "All"
        num_results = RETRIEVAL_TOP_K_FILTERED if use_filter else RETRIEVAL_TOP_K

        def _search(with_server_filter: bool) -> list[dict]:
            search_kwargs = {
                "query_text": query,
                "columns": ["title", "file_format", "languages", "url", "content_text"],
                "num_results": num_results,
            }
            if with_server_filter and use_filter:
                server_values = MEDIA_FILTER_SERVER_VALUES.get(media_filter)
                if server_values:
                    search_kwargs["filters"] = {"file_format": server_values}
            results = index.similarity_search(**search_kwargs)
            rows = results.get("result", {}).get("data_array", [])
            return _filter_documents_by_media(_rows_to_documents(rows), media_filter)

        documents = _search(with_server_filter=True)
        if use_filter and len(documents) < 3:
            documents = _search(with_server_filter=False)

        if use_filter and not documents:
            return [{
                "error": (
                    f'No {media_filter} sources matched this query. '
                    f'Try "All" or another media type.'
                ),
            }]
        if not documents:
            return [{"error": "No relevant sources found for this query."}]
        return documents
    except Exception as e:
        print(f"[ERROR] Retrieval failed: {e}", file=sys.stderr)
        traceback.print_exc()
        return [{"error": str(e)}]


def generate_answer(query, context_docs, language_pref="English", lang_code: str = DEFAULT_LANG_CODE):
    """Generate answer using LLM with retrieved context."""
    code = (lang_code or DEFAULT_LANG_CODE).upper()
    cite_label = SOURCE_REF_LABELS.get(code, "Source")
    translate_source_titles(context_docs, code)

    context_parts = []
    for i, doc in enumerate(context_docs, 1):
        if "error" in doc:
            continue
        icon = MEDIA_ICONS.get(_normalize_file_format(doc.get("file_format", "")), "")
        display_name = _source_display_name(doc, code)
        context_parts.append(
            f"--- [{i}] {icon} {display_name} "
            f"(Type: {doc['file_format']}, Language: {doc['language']}) ---\n"
            f"{doc['content']}"
        )
    context_text = "\n\n".join(context_parts)
    refs_heading = REFERENCES_HEADINGS.get(code, "References")

    if not context_text.strip():
        empty_msgs = {
            "EN": "I could not find enough relevant content in the retrieved sources to answer this question.",
            "ES": "No encontré suficiente contenido relevante en las fuentes recuperadas para responder a esta pregunta.",
            "FR": "Je n'ai pas trouvé suffisamment de contenu pertinent dans les sources récupérées pour répondre à cette question.",
            "IT": "Non ho trovato contenuti sufficienti nelle fonti recuperate per rispondere a questa domanda.",
            "POR": "Não encontrei conteúdo relevante suficiente nas fontes recuperadas para responder a esta pergunta.",
        }
        return empty_msgs.get(code, empty_msgs["EN"])

    system_prompt = f"""You are a knowledgeable assistant for the Salesian Online educational platform.
Your role is to answer questions about Salesian education content, which includes:
- PDF documents (questionnaires, focus group guides, circulars)
- Word documents and presentations
- Audio recordings (interviews, lectures)
- Images (logos, covers)
- Videos (promotional and educational content)

The content spans multiple languages: English, Spanish, French, Italian, and Portuguese.

Rules:
1. Answer in {language_pref}.
2. Base your answer ONLY on the provided context — synthesize across ALL listed sources when relevant.
3. If the context is partial, say what is missing, then explain everything you CAN conclude from the sources.
4. Write a substantive answer (not a one-line summary). Aim for roughly 4–8 paragraphs or equivalent structured sections.
5. Structure the response as:
   - Opening: direct answer in 2–4 sentences
   - **Key points:** bullet list (5–10 bullets when the context supports it)
   - **Details:** one or more paragraphs expanding on themes, dates, people, and practices from the sources
   - **{refs_heading}:** bullet list citing each source you used
6. When you cite a source inline or in references, use:
   **{cite_label} N:** document title from context
   Use the index N from the context headers [1], [2], etc. Titles only — never paste URLs.
7. Do not include http/https links anywhere in your answer.
"""

    user_message = f"""Based on the following retrieved documents, answer this question in depth.

**Question:** {query}

**Retrieved Context ({len(context_parts)} sources):**
{context_text}

Provide a comprehensive answer that synthesizes information across sources. Include specific facts, names, and themes from the context. End with a **{refs_heading}** section listing every source you relied on."""

    try:
        client = get_llm_client()
        response = client.chat.completions.create(
            model=LLM_ENDPOINT,
            messages=[{"role": "system", "content": system_prompt},
                     {"role": "user", "content": user_message}],
            max_tokens=MAX_ANSWER_TOKENS,
            temperature=0.35,
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
    f = str(fmt).lower().strip().lstrip(".")
    if f in ("pdf",):
        return "pdf"
    if f in ("doc", "docx", "word", "document", "rtf", "odt"):
        return "doc"
    if f in ("ppt", "pptx", "presentation", "odp"):
        return "ppt"
    if f in ("xls", "xlsx", "csv", "spreadsheet", "ods"):
        return "sheet"
    if f in ("jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "image", "img"):
        return "image"
    if f in ("mp3", "wav", "ogg", "m4a", "audio", "mpeg"):
        return "audio"
    if f in ("mp4", "mov", "avi", "mkv", "webm", "video"):
        return "video"
    return f if f in MEDIA_ICONS else "other"



def _source_display_name(doc: dict, lang_code: str) -> str:
    code = (lang_code or DEFAULT_LANG_CODE).upper()
    if code == "EN":
        return doc.get("file_name", "")
    return doc.get("display_names", {}).get(code, doc.get("file_name", ""))


def translate_source_titles(docs, lang_code: str) -> None:
    """Cache translated document titles per language."""
    code = (lang_code or DEFAULT_LANG_CODE).upper()
    pending = []
    for doc in docs:
        if "error" in doc:
            continue
        cache = doc.setdefault("display_names", {})
        cache.setdefault("EN", doc.get("file_name", ""))
        if code == "EN":
            cache["EN"] = doc.get("file_name", "")
            continue
        if code not in cache:
            pending.append(doc)
    if not pending:
        return

    language = _language_name(code)
    numbered = "\n".join(f"{i + 1}. {doc['file_name']}" for i, doc in enumerate(pending))
    prompt = (
        f"Translate each document title below into {language}.\n"
        "Return ONLY a JSON array of strings, same order and count.\n\n"
        f"Titles:\n{numbered}"
    )
    try:
        client = get_llm_client()
        response = client.chat.completions.create(
            model=LLM_ENDPOINT,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=768,
            temperature=0.2,
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        translated = json.loads(raw)
        if not isinstance(translated, list) or len(translated) != len(pending):
            raise ValueError("unexpected translation shape")
        for doc, title in zip(pending, translated):
            doc["display_names"][code] = str(title).strip() or doc["file_name"]
    except Exception as e:
        print(f"[WARN] Source title translation failed: {e}", file=sys.stderr)
        traceback.print_exc()
        for doc in pending:
            doc["display_names"][code] = doc.get("file_name", "")


def _md_escape_url(url: str) -> str:
    return (url or "").replace(")", "%29")


def _looks_like_url(text: str) -> bool:
    t = (text or "").strip().lower()
    return t.startswith("http://") or t.startswith("https://")


def _replace_visible_urls(text: str, docs, lang_code: str) -> str:
    """Turn bare URLs and [url](url) links into titled markdown links."""
    if not text or not docs:
        return text
    code = (lang_code or DEFAULT_LANG_CODE).upper()
    out = text
    for doc in docs:
        if "error" in doc:
            continue
        url = (doc.get("url") or "").strip()
        if not url:
            continue
        name = _source_display_name(doc, code)
        url_md = _md_escape_url(url)
        md_link = f"[{name}]({url_md})"
        url_pat = re.escape(url)
        out = re.sub(
            rf"\[\s*{url_pat}\s*\]\(\s*{url_pat}\s*\)",
            md_link,
            out,
            flags=re.IGNORECASE,
        )
        out = re.sub(
            rf"(?<!\]\()(?<!\[){url_pat}(?!\))",
            md_link,
            out,
            flags=re.IGNORECASE,
        )
    return out


def _link_phrase_in_text(text: str, phrase: str, url: str) -> str:
    """Link every occurrence of phrase when it is not already part of a markdown link."""
    phrase = (phrase or "").strip()
    if len(phrase) < 3 or not url:
        return text
    url_md = _md_escape_url(url)
    link = f"[{phrase}]({url_md})"
    if link in text:
        return text
    pattern = rf"(?<!\[)({re.escape(phrase)})(?!\]\([^)]*\))"
    return re.sub(pattern, link, text, flags=re.IGNORECASE)


def _link_source_citation_lines(text: str, docs, lang_code: str) -> str:
    """Link full lines after **Source N:** (any media type with a URL)."""
    cite_labels = "|".join(re.escape(v) for v in set(SOURCE_REF_LABELS.values()))
    out = text
    code = (lang_code or DEFAULT_LANG_CODE).upper()

    for i, doc in enumerate(docs, 1):
        if "error" in doc:
            continue
        url = (doc.get("url") or "").strip()
        if not url:
            continue
        name = _source_display_name(doc, code)
        url_md = _md_escape_url(url)

        line_pattern = (
            rf"(?:^|\n)(\s*[-*]?\s*)"
            rf"(\*\*(?:{cite_labels})\s*{i}\s*:?\s*\*\*\s*:?\s*)"
            rf"([^\n]+)"
        )

        def _line_repl(match, display=name, link_url=url_md):
            prefix, label, body = match.group(1), match.group(2), match.group(3).strip()
            body_plain = re.sub(r"\*+", "", body).strip()
            if "](http" in body or "[https://" in body.lower():
                return match.group(0)
            if not body_plain or _looks_like_url(body_plain):
                target = display
            else:
                target = body_plain
            return f"{prefix}{label}[{target}]({link_url})"

        out = re.sub(line_pattern, _line_repl, out, flags=re.IGNORECASE)

    return out


def _append_linked_references(answer: str, docs, lang_code: str) -> str:
    """Append a fully linked reference list (all formats with URLs)."""
    code = (lang_code or DEFAULT_LANG_CODE).upper()
    heading = REFERENCES_HEADINGS.get(code, "References")
    cite = SOURCE_REF_LABELS.get(code, "Source")

    if re.search(
        r"(?i)\*\*(?:references|referencias|références|riferimenti|referências)\s*:?\*\*",
        answer,
    ):
        return answer

    lines = [f"\n\n**{heading} :**\n"]
    for i, doc in enumerate(docs, 1):
        if "error" in doc:
            continue
        name = _source_display_name(doc, code)
        url = (doc.get("url") or "").strip()
        if url:
            lines.append(f"- **{cite} {i}:** [{name}]({_md_escape_url(url)})\n")
        else:
            lines.append(f"- **{cite} {i}:** {name}\n")
    return answer.rstrip() + "".join(lines)


def linkify_answer_sources(answer: str, docs, lang_code: str) -> str:
    """Link all cited sources in the answer (PDF, DOCX, PPT, images, etc.)."""
    if not answer or not docs:
        return answer

    code = (lang_code or DEFAULT_LANG_CODE).upper()
    translate_source_titles(docs, code)
    out = _replace_visible_urls(answer, docs, code)
    out = _link_source_citation_lines(out, docs, code)

    phrases: list[tuple[str, str]] = []
    seen: set[str] = set()
    for doc in docs:
        if "error" in doc:
            continue
        url = (doc.get("url") or "").strip()
        if not url:
            continue
        for title in (_source_display_name(doc, code), doc.get("file_name", "")):
            title = (title or "").strip()
            key = title.lower()
            if len(title) >= 4 and key not in seen:
                seen.add(key)
                phrases.append((title, url))

    phrases.sort(key=lambda item: len(item[0]), reverse=True)
    for title, url in phrases:
        out = _link_phrase_in_text(out, title, url)

    return _append_linked_references(out, docs, code)


def answer_to_html(answer: str, docs, lang_code: str) -> str:
    linked = linkify_answer_sources(answer, docs, lang_code)
    return markdown_to_html(linked)


def format_sources(docs, lang_code: str = DEFAULT_LANG_CODE):
    """Sidebar source cards — translated titles, whole card opens URL."""
    if not docs or "error" in docs[0]:
        return '<div class="sources-empty">No sources retrieved.</div>'

    code = (lang_code or DEFAULT_LANG_CODE).upper()
    translate_source_titles(docs, code)
    open_labels = OPEN_RESOURCE_LABELS.get(code, OPEN_RESOURCE_LABELS["EN"])

    badge_class = {
        "pdf": "src-badge-pdf",
        "doc": "src-badge-doc",
        "audio": "src-badge-audio",
        "image": "src-badge-image",
        "video": "src-badge-video",
        "ppt": "src-badge-ppt",
        "sheet": "src-badge-sheet",
    }
    cards = ""
    for i, doc in enumerate(docs, 1):
        if "error" in doc:
            continue
        mtype = _normalize_file_format(doc.get("file_format", ""))
        icon = MEDIA_ICONS.get(mtype, "")
        bclass = badge_class.get(mtype, "src-badge-other")
        display_name = _source_display_name(doc, code)
        name_esc = html.escape(display_name)
        url = (doc.get("url") or "").strip()
        open_label = open_labels.get(mtype, open_labels["other"])

        inner = (
            f'<div class="src-card-title">{i}. {icon} '
            f'<span class="src-file-name">{name_esc}</span></div>'
            f'<div class="src-card-meta">'
            f'  <span class="src-badge {bclass}">{html.escape(mtype.upper())}</span>'
            f"  {_language_pills_html(doc.get('language'))}"
            f"</div>"
        )
        if url:
            url_esc = html.escape(url, quote=True)
            inner += f'<span class="src-open-hint">{html.escape(open_label)} &#8599;</span>'
            cards += (
                f'<a class="src-card src-card-link" href="{url_esc}" target="_blank" '
                f'rel="noopener noreferrer" title="{name_esc}">{inner}</a>'
            )
        else:
            cards += f'<div class="src-card src-card-static">{inner}</div>'

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
_md = MarkdownIt("commonmark", {"linkify": False})


def _answer_links_open_new_tab(html: str) -> str:
    """Ensure answer links open in a new tab."""

    def _add_attrs(match: re.Match) -> str:
        attrs = match.group(1)
        if re.search(r"\btarget\s*=", attrs, re.IGNORECASE):
            return match.group(0)
        return f'<a target="_blank" rel="noopener noreferrer"{attrs}>'

    return re.sub(r"<a(\s+[^>]*?)>", _add_attrs, html, flags=re.IGNORECASE)


def markdown_to_html(text: str) -> str:
    if not text or not text.strip():
        return ""
    stripped = text.strip()
    if stripped.startswith("<") and any(tag in stripped for tag in ("<div", "<p", "<span")):
        return text
    return _answer_links_open_new_tab(_md.render(text))


class QueryRequest(BaseModel):
    query: str
    media_filter: str = "All"
    lang_code: str = DEFAULT_LANG_CODE


class LanguageRequest(BaseModel):
    lang_code: str = DEFAULT_LANG_CODE


def _ui_labels_payload(lang_code: str) -> dict:
    code = (lang_code or DEFAULT_LANG_CODE).upper()
    labels = UI_SECTION_LABELS.get(code, UI_SECTION_LABELS["EN"])
    return {"ui_labels": labels}


def _sse_payload(answer_html: str | None = None, sources_html: str | None = None, ui_labels: dict | None = None) -> str:
    data = {}
    if answer_html is not None:
        data["answer_html"] = answer_html
    if sources_html is not None:
        data["sources_html"] = sources_html
    if ui_labels is not None:
        data["ui_labels"] = ui_labels
    return f"data: {json.dumps(data)}\n\n"


def _chat_events(message: str, media_filter: str, lang_code: str = DEFAULT_LANG_CODE):
    global _last_query, _last_docs, _last_lang_code, _last_media_filter
    if not message or not message.strip():
        yield _sse_payload("", "")
        return

    yield _sse_payload(LOADING_RETRIEVE, LOADING_RETRIEVE)
    _last_query = message.strip()
    _last_lang_code = (lang_code or DEFAULT_LANG_CODE).upper()
    _last_media_filter = media_filter or "All"
    docs = retrieve_context(message, media_filter=_last_media_filter)
    _last_docs = docs

    if docs and "error" in docs[0]:
        err = f"<p><strong>Retrieval error:</strong> {docs[0]['error']}</p>"
        yield _sse_payload(err, '<div class="sources-empty">No sources available.</div>')
        return

    sources = format_sources(docs, _last_lang_code)
    yield _sse_payload(LOADING_GENERATE, sources)
    answer = generate_answer(
        message, docs, language_pref=_language_name(_last_lang_code), lang_code=_last_lang_code
    )
    yield _sse_payload(answer_to_html(answer, docs, _last_lang_code), sources)


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
    sources = format_sources(_last_docs, _last_lang_code)
    answer = generate_answer(
        _last_query,
        _last_docs,
        language_pref=_language_name(_last_lang_code),
        lang_code=_last_lang_code,
    )
    yield _sse_payload(
        answer_to_html(answer, _last_docs, _last_lang_code),
        sources,
        _ui_labels_payload(_last_lang_code),
    )


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