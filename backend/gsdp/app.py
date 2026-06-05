"""GSDP - Semantic Search Application V2 (Hybrid Retrieval + Diagnostics)"""

# Load .env for local development only (not on Databricks Apps where OAuth is auto-configured)
import os as _os
if not _os.environ.get("DATABRICKS_CLIENT_ID"):
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

import streamlit as st
import base64
import time
import re
from databricks.sdk import WorkspaceClient
from config import APP_TITLE, APP_ICON, MAX_SEARCH_RESULTS

st.set_page_config(page_title=APP_TITLE, page_icon=APP_ICON, layout="wide", initial_sidebar_state="collapsed")

st.markdown("""
<style>
#MainMenu {visibility: hidden;}
header {visibility: hidden;}
footer {visibility: hidden;}
.block-container { padding-top: 1rem !important; }
h1 { margin-top: 0 !important; padding-top: 0 !important; }
section[data-testid="stMain"] > div { min-height: 80vh; }

.result-even {
    background: #f0f7ff;
    padding: 14px 18px;
    border-radius: 8px;
    margin-bottom: 6px;
    border-left: 4px solid #4285f4;
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.result-even:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(66, 133, 244, 0.15);
    background: #e3effd;
}
.result-odd {
    background: #f9faf9;
    padding: 14px 18px;
    border-radius: 8px;
    margin-bottom: 6px;
    border-left: 4px solid #34a853;
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.result-odd:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(52, 168, 83, 0.15);
    background: #e6f4ea;
}
.result-title {
    font-size: 17px;
    font-weight: 600;
    color: #1a0dab;
    margin-bottom: 2px;
    cursor: pointer;
    list-style: none;
}
.result-title::-webkit-details-marker {
    display: none;
}
.result-title::before {
    content: '\25B6';
    font-size: 10px;
    color: #9aa0a6;
    margin-right: 8px;
    transition: transform 0.2s ease;
    display: inline-block;
}
details[open] > .result-title::before {
    transform: rotate(90deg);
    color: #1a73e8;
}
.result-full-text {
    margin-top: 10px;
    padding: 12px 16px;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 13px;
    color: #3c4043;
    line-height: 1.7;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
}
.result-meta {
    font-size: 12px;
    color: #5f6368;
    margin-bottom: 8px;
    line-height: 1.7;
}
.result-meta .meta-label {
    display: inline-block;
    background: #e8f0fe;
    color: #1967d2;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    margin-right: 5px;
    font-weight: 500;
}
.result-meta .meta-label.type-label {
    background: #fce8e6;
    color: #c5221f;
}
.result-meta .meta-label.date-label {
    background: #e6f4ea;
    color: #137333;
}
.result-meta .meta-label.score-label {
    background: #fff3cd;
    color: #856404;
}
.result-meta .attr-line {
    display: block;
    margin-top: 4px;
    font-size: 12.5px;
    color: #5f6368;
}
.result-snippet {
    font-size: 13.5px;
    color: #3c4043;
    line-height: 1.6;
    margin-top: 6px;
}
.result-snippet b {
    color: #202124;
    background: #fff3cd;
    padding: 0 2px;
    border-radius: 2px;
}

/* --- hide iframe border for toolbar component --- */
iframe[title="st_components_v1.html"] {
    border: none !important;
}

/* --- PDF download buttons (result cards) --- */
div[data-testid="stDownloadButton"] button {
    background: none !important;
    border: none !important;
    color: #1a73e8 !important;
    font-size: 12px !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    font-weight: normal !important;
    box-shadow: none !important;
}
div[data-testid="stDownloadButton"] button:hover {
    text-decoration: underline !important;
    background: none !important;
}
div[data-testid="stDownloadButton"] button p {
    font-size: 12px !important;
}
div[data-testid="stDownloadButton"] {
    margin-top: -8px;
    margin-bottom: 8px;
}
</style>
""", unsafe_allow_html=True)

VOLUME_PATH = "/Volumes/gsdp_poc/raw/docs"


@st.cache_resource
def get_ws_client():
    """Get WorkspaceClient - works both on Databricks Apps and locally."""
    import os
    if not os.environ.get("DATABRICKS_CLIENT_ID"):
        host = os.environ.get("DATABRICKS_HOST")
        token = os.environ.get("DATABRICKS_TOKEN")
        if host and token:
            return WorkspaceClient(host=host, token=token)
    return WorkspaceClient()


@st.cache_data(ttl=600, show_spinner=False)
def cached_query(query_str: str):
    from data_access import run_query
    return run_query(query_str)


@st.cache_data(ttl=600, show_spinner=False)
def get_corpus_stats():
    return cached_query("""
        SELECT COUNT(*) AS total_documents,
               CAST(MIN(doc_date) AS STRING) AS earliest,
               CAST(MAX(doc_date) AS STRING) AS latest,
               COUNT(DISTINCT author) AS authors,
               COUNT(DISTINCT doc_type) AS types
        FROM gsdp_poc.gold.dim_documents
    """)


@st.cache_data(ttl=600, show_spinner=False)
def get_documents_list():
    return cached_query("""
        SELECT file_name, author, doc_type,
               CAST(doc_date AS STRING) AS doc_date, location
        FROM gsdp_poc.gold.dim_documents
        ORDER BY doc_date DESC NULLS LAST
    """)


@st.cache_data(ttl=300, show_spinner=False)
def get_pdf_bytes(file_name: str) -> bytes:
    try:
        w = get_ws_client()
        resp = w.files.download(f"{VOLUME_PATH}/{file_name}")
        return resp.contents.read()
    except Exception:
        return None


@st.cache_data(ttl=60, show_spinner=False)
def do_search(query_text: str, num_results: int, enable_reranking: bool, enable_expansion: bool):
    from search_backend import query_don_bosco
    return query_don_bosco(
        query_text,
        num_results=num_results,
        enable_reranking=enable_reranking,
        enable_expansion=enable_expansion,
    )


def _detect_listing_type(query: str):
    """Detect if query is asking for an exhaustive listing. 
    
    Returns:
        str: single doc_type like "letter"
        list: multiple types like ["letter", "appeal"] for parent categories
        None: not a listing query
    """
    q = query.lower().strip()
    type_map = {
        "letter": "letter", "letters": "letter",
        "chapter": "chapter", "chapters": "chapter",
        "appeal": "appeal", "appeals": "appeal",
        "section": "section", "sections": "section",
        "regulation": "regulation", "regulations": "regulation",
        "memoir": "monolithic", "memoirs": "monolithic",
    }
    # Parent categories that expand to multiple child types
    parent_map = {
        "communication": ["letter", "appeal"],
        "communications": ["letter", "appeal"],
        "publication": ["chapter", "monolithic"],
        "publications": ["chapter", "monolithic"],
    }
    patterns = [
        r'\b(?:list|show|give|display|enumerate)\s+(?:me\s+)?(?:all|every|the)\s+(?:the\s+)?(\w+)',
        r'\b(?:how many|count)\s+(?:the\s+)?(\w+)',
        r'\b(?:what are)\s+(?:all\s+)?(?:the\s+)?(\w+)',
    ]
    for pat in patterns:
        m = re.search(pat, q)
        if m:
            word = m.group(1).strip().lower()
            if word in type_map:
                return type_map[word]
            if word in parent_map:
                return parent_map[word]  # Return list of child types
    return None


def do_listing_search(doc_type) -> dict:
    """Directly query bronze_sub_documents for a full catalog listing.
    
    Bypasses RAG entirely — uses SDK statement execution to get all items.
    """
    from databricks.sdk.service.sql import StatementState
    import os

    w = get_ws_client()

    # Handle both single type (str) and multiple types (list)
    if isinstance(doc_type, list):
        type_clause = ", ".join([f"'{t}'" for t in doc_type])
        type_label = " + ".join([t.capitalize() + "s" for t in doc_type])
    else:
        type_clause = f"'{doc_type}'"
        type_label = doc_type.capitalize() + "s"

    wh_id = os.environ.get("DATABRICKS_SQL_WAREHOUSE_ID", "c01af5f8d785be11")

    sql = f"""
        SELECT title, recipient, location,
               CAST(doc_date AS STRING) AS doc_date,
               parent_file_name AS file_name,
               sub_doc_type,
               char_count
        FROM gsdp_poc.raw.bronze_sub_documents
        WHERE sub_doc_type IN ({type_clause})
        ORDER BY parent_file_name, sub_doc_sequence
    """

    try:
        result = w.statement_execution.execute_statement(
            warehouse_id=wh_id, statement=sql, wait_timeout="50s"
        )
        if not (result.status and result.status.state == StatementState.SUCCEEDED):
            return None
        if not result.result or not result.result.data_array:
            return None

        cols = [c.name for c in result.manifest.schema.columns]
        rows = [dict(zip(cols, r)) for r in result.result.data_array]
    except Exception:
        return None

    if not rows:
        return None

    # Build structured markdown answer
    total = len(rows)
    # type_label already defined above for both single and multi-type
    by_pdf = {}
    for r in rows:
        fn = r.get("file_name", "Unknown")
        by_pdf.setdefault(fn, []).append(r)

    lines = [
        f"## All {type_label} in the GSDP Corpus ({total} total)\n",
        f"Found **{total}** items across **{len(by_pdf)} source documents**.\n",
    ]
    for fn, items in sorted(by_pdf.items()):
        display = re.sub(r"^\d+\.\d+\.\d+-", "", fn.replace(".pdf", "").replace("Bosco-", "")).replace("-", " ").strip()
        lines.append(f"\n### {display} ({len(items)} items)\n")
        for item in items:
            title = item.get("title") or "Untitled"
            parts = [f"- **{title}**"]
            if item.get("recipient"):
                parts.append(f"  \u2192 {item['recipient']}")
            if item.get("location") and item.get("doc_date"):
                parts.append(f"  ({item['location']}, {item['doc_date']})")
            elif item.get("doc_date"):
                parts.append(f"  ({item['doc_date']})")
            elif item.get("location"):
                parts.append(f"  ({item['location']})")
            lines.append("".join(parts))

    answer = "\n".join(lines)

    sources = []
    for r in rows[:50]:
        sources.append({
            "file_name": r.get("file_name", ""),
            "page_id": 1,
            "chunk_id": "",
            "doc_type": r.get("sub_doc_type", doc_type if isinstance(doc_type, str) else ""),
            "author": "Don Bosco",
            "recipient": r.get("recipient", ""),
            "location": r.get("location", ""),
            "doc_date": r.get("doc_date", ""),
            "content": r.get("title", ""),
            "confidence": 1.0,
            "keyword_score": 1.0,
            "vector_score": 0,
            "hybrid_score": 1.0,
            "rerank_score": 1.0,
            "final_score": 1.0,
        })

    return {
        "answer": answer,
        "sources": sources,
        "diagnostics": {
            "search_mode": "listing_query",
            "doc_type": r.get("sub_doc_type", doc_type if isinstance(doc_type, str) else ""),
            "total_items": total,
            "source_pdfs": len(by_pdf),
            "total_latency_ms": 0,
        },
    }


def format_title(filename):
    if not filename:
        return "Unknown Document", ""
    name = filename.replace(".pdf", "")
    if name.startswith("Bosco-"):
        rest = name[6:]
        match = re.match(r"(\d+\.\d+\.\d+)-(.+)", rest)
        if match:
            return match.group(2).replace("-", " ").title(), match.group(1)
    return name.replace("-", " ").title(), ""


def get_meaningful_snippet(content, query_text="", max_len=220):
    if not content:
        return ""
    skip_phrases = [
        "SALESIAN HISTORICAL INSTITUTE", "Salesian Sources",
        "DON BOSCO AND HIS WORK", "Collected works", "LAS - ROME",
        "KRISTU JYOTI PUBLICATIONS", "Bosco Nagar", "Bengaluru",
        "donboscoimage.com", "The original It",
    ]
    lines = content.split("\n")
    meaningful = [s.strip() for s in lines
                  if s.strip() and len(s.strip()) >= 15
                  and not any(p.lower() in s.lower() for p in skip_phrases)]
    text = " ".join(meaningful)

    if query_text and len(text) > max_len:
        words = [w for w in query_text.lower().split() if len(w) > 3]
        best_pos = 0
        for word in words:
            pos = text.lower().find(word)
            if pos > 0:
                best_pos = max(0, pos - 60)
                break
        snippet = text[best_pos:best_pos + max_len]
        if best_pos > 0:
            snippet = "..." + snippet
        if best_pos + max_len < len(text):
            snippet = snippet + "..."
    else:
        snippet = (text[:max_len] + "...") if len(text) > max_len else text

    if query_text:
        stop_words = {"give", "show", "find", "list", "tell", "what", "where",
                      "when", "which", "that", "this", "from", "with", "about",
                      "have", "been", "were", "will", "would", "could", "should",
                      "their", "there", "them", "they", "your", "into", "also",
                      "more", "some", "than", "other", "make", "made", "all"}
        for word in query_text.split():
            if len(word) > 3 and word.lower() not in stop_words:
                pattern = re.compile(re.escape(word), re.IGNORECASE)
                snippet = pattern.sub(lambda m: f"<b>{m.group()}</b>", snippet)
    return snippet


# --- MAIN UI ---
st.title(f"{APP_ICON} Global Salesian Digital Platform")

# --- Navigation ---
_page = st.sidebar.radio(
    "Navigate", ["\U0001f50d Search", "\U0001f578\ufe0f Knowledge Graph", "\u2699\ufe0f Pipeline"],
    label_visibility="collapsed"
)

_is_search_page = (_page == "\U0001f50d Search")

if _is_search_page:
    with st.form("search_form", clear_on_submit=False):
        query = st.text_input("Search", placeholder="Search Don Bosco documents...",
                              label_visibility="collapsed")
        submitted = st.form_submit_button("Search", use_container_width=True)
        enable_reranking = True
        enable_expansion = True

    if submitted and query:
        st.session_state["last_query"] = query

active_query = st.session_state.get("last_query", "") if _is_search_page else ""
active_rerank = True
active_expand = True

if active_query:
    with st.spinner("Searching..."):
        # Check if this is a listing query (list all letters, show all chapters, etc.)
        _listing_type = _detect_listing_type(active_query)
        if _listing_type:
            result = do_listing_search(_listing_type)
            if result is None:
                # Fallback to RAG if listing query fails
                result = do_search(active_query, MAX_SEARCH_RESULTS, active_rerank, active_expand)
        else:
            result = do_search(active_query, MAX_SEARCH_RESULTS, active_rerank, active_expand)
    sources = result.get("sources", [])
    diagnostics = result.get("diagnostics", {})

    total_ms = diagnostics.get("total_latency_ms", 0)
    st.caption(f"About {len(sources)} results  \u2022  {total_ms} ms")

    answer = result.get("answer", "")
    if answer:
        with st.container():
            st.markdown(answer)

            # --- ChatGPT-style icon toolbar (self-contained HTML component) ---
            import urllib.parse, json as _json
            download_content = f"# GSDP Search: {active_query}\n\n{answer}"
            num_sources = len([s for s in sources[:5] if s.get("file_name")])
            escaped_answer = _json.dumps(answer)
            escaped_download = _json.dumps(download_content)
            dl_filename = f"gsdp_{active_query[:30].replace(' ', '_')}.md"

            st.components.v1.html(f"""
            <style>
            * {{ margin:0; padding:0; box-sizing:border-box; }}
            body {{ background:transparent; overflow:hidden; }}
            .toolbar {{
                display:inline-flex; align-items:center; gap:2px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            }}
            .toolbar .btn {{
                display:inline-flex; align-items:center; justify-content:center;
                width:30px; height:30px; border-radius:6px;
                cursor:pointer; border:none; background:transparent;
                transition:background .12s;
            }}
            .toolbar .btn:hover {{ background:#f2f2f2; }}
            .toolbar .btn.active {{ background:#e8f0fe; }}
            .toolbar .btn.active svg {{ stroke:#1a73e8; }}
            .toolbar .btn svg {{
                width:18px; height:18px; stroke:#676767; fill:none;
                stroke-width:2; stroke-linecap:round; stroke-linejoin:round;
            }}
            .toolbar .btn:hover svg {{ stroke:#2b2b2b; }}
            .toolbar .sep {{
                width:1px; height:16px; background:#e0e0e0; margin:0 8px;
            }}
            .toolbar .sources {{
                display:inline-flex; align-items:center; gap:6px;
                padding:5px 10px; border-radius:6px; cursor:pointer;
                color:#676767; font-size:13px; font-weight:500;
                border:none; background:transparent;
                transition:background .12s;
            }}
            .toolbar .sources:hover {{ background:#f2f2f2; color:#2b2b2b; }}
            .toolbar .sources svg {{
                width:16px; height:16px; stroke:currentColor; fill:none;
                stroke-width:2; stroke-linecap:round; stroke-linejoin:round;
            }}
            .toast {{
                position:fixed; bottom:12px; left:50%; transform:translateX(-50%);
                background:#333; color:#fff; padding:6px 16px; border-radius:8px;
                font-size:13px; opacity:0; transition:opacity .3s;
                pointer-events:none; z-index:999;
            }}
            .toast.show {{ opacity:1; }}
            </style>

            <div class="toolbar">
                <button class="btn" id="copyBtn" title="Copy">
                    <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
                <button class="btn" id="likeBtn" title="Good response">
                    <svg viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
                </button>
                <button class="btn" id="dislikeBtn" title="Bad response">
                    <svg viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h3a2 2 0 012 2v7a2 2 0 01-2 2h-3"/></svg>
                </button>
                <button class="btn" id="dlBtn" title="Download">
                    <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <button class="btn" id="retryBtn" title="Retry">
                    <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                </button>
                <button class="btn" id="moreBtn" title="More" style="letter-spacing:2px;color:#676767;font-weight:bold;font-size:16px;">
                    &middot;&middot;&middot;
                </button>
                <div class="sep"></div>
                <button class="sources" id="srcBtn">
                    <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                    Sources
                </button>
            </div>
            <div class="toast" id="toast"></div>

            <script>
            function showToast(msg) {{
                var t = document.getElementById('toast');
                t.textContent = msg;
                t.classList.add('show');
                setTimeout(function(){{ t.classList.remove('show'); }}, 2000);
            }}

            // Copy
            document.getElementById('copyBtn').onclick = function() {{
                navigator.clipboard.writeText({escaped_answer}).then(function(){{
                    showToast('\u2705 Copied to clipboard');
                }});
            }};

            // Thumbs up
            document.getElementById('likeBtn').onclick = function() {{
                this.classList.toggle('active');
                document.getElementById('dislikeBtn').classList.remove('active');
                showToast('\U0001f44d Thanks for the feedback!');
            }};

            // Thumbs down
            document.getElementById('dislikeBtn').onclick = function() {{
                this.classList.toggle('active');
                document.getElementById('likeBtn').classList.remove('active');
                showToast('Noted — we\\'ll improve!');
            }};

            // Download
            document.getElementById('dlBtn').onclick = function() {{
                var blob = new Blob([{escaped_download}], {{type:'text/markdown'}});
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = "{dl_filename}";
                a.click();
                URL.revokeObjectURL(url);
                showToast('\u2913 Downloaded');
            }};

            // Retry
            document.getElementById('retryBtn').onclick = function() {{
                showToast('\u21BB Retrying...');
                window.parent.location.reload();
            }};

            // More
            document.getElementById('moreBtn').onclick = function() {{
                showToast('More options coming soon');
            }};

            // Sources
            document.getElementById('srcBtn').onclick = function() {{
                window.parent.document.querySelector('[data-testid="stMarkdownContainer"]').scrollIntoView({{behavior:'smooth'}});
            }};
            </script>
            """, height=42)

            st.markdown("---")
        # PDF download links for source documents cited in the answer
        seen_files = set()
        source_pdfs = []
        for src in sources[:5]:
            fn = src.get("file_name", "")
            if fn and fn not in seen_files:
                seen_files.add(fn)
                source_pdfs.append(fn)
        if source_pdfs:
            st.markdown("**\U0001f4ce Source Documents:**")
            cols = st.columns(min(len(source_pdfs), 3))
            for idx, fn in enumerate(source_pdfs):
                title, _ = format_title(fn)
                pdf_bytes = get_pdf_bytes(fn)
                if pdf_bytes:
                    cols[idx % 3].download_button(
                        f"\U0001f4c4 {title}",
                        data=pdf_bytes,
                        file_name=fn,
                        mime="application/pdf",
                        key=f"ans_pdf_{idx}",
                    )

    sort_by = st.radio("Sort", ["Relevance", "Date \u2193", "Date \u2191"],
                       horizontal=True, label_visibility="collapsed")
    if sort_by == "Date \u2193":
        sources = sorted(sources, key=lambda x: x.get("doc_date") or "", reverse=True)
    elif sort_by == "Date \u2191":
        sources = sorted(sources, key=lambda x: x.get("doc_date") or "")

    for i, s in enumerate(sources):
        file_name = s.get("file_name", "Unknown")
        title_text, section = format_title(file_name)
        author = s.get("author") or "Don Bosco"
        recipient = s.get("recipient") or ""
        location = s.get("location") or ""
        doc_date = s.get("doc_date") or ""
        doc_type = s.get("doc_type") or ""
        content_text = s.get("content") or ""

        snippet = get_meaningful_snippet(content_text, active_query, max_len=300)

        final_score = float(s.get("final_score", 0))

        # Build pill-shaped metadata labels
        meta_pills = []
        if doc_type:
            meta_pills.append(f'<span class="meta-label type-label">{doc_type.title()}</span>')
        if doc_date:
            meta_pills.append(f'<span class="meta-label date-label">{doc_date}</span>')
        if section:
            meta_pills.append(f'<span class="meta-label">\u00a7{section}</span>')
        score_pct = int(final_score * 100)
        if score_pct > 0:
            meta_pills.append(f'<span class="meta-label score-label">Relevance: {score_pct}%</span>')

        # Build readable attribution line (no emoji overload)
        attr_parts = []
        if author:
            attr_parts.append(f"By <b>{author}</b>")
        if recipient:
            attr_parts.append(f"To: {recipient}")
        if location:
            attr_parts.append(f"\U0001f4cd {location}")
        attr_line = "&nbsp;&nbsp;\u2022&nbsp;&nbsp;".join(attr_parts) if attr_parts else ""

        meta_html = " ".join(meta_pills)
        if attr_line:
            meta_html += f'<span class="attr-line">{attr_line}</span>'

        card_class = "result-even" if i % 2 == 0 else "result-odd"

        # Prepare full text for expandable view (escape HTML)
        import html as html_mod
        full_text_escaped = html_mod.escape(content_text[:2000]) if content_text else ""

        st.markdown(
            f'<div class="{card_class}">'
            f'<details>'
            f'<summary class="result-title">{title_text}</summary>'
            f'<div class="result-full-text">{full_text_escaped}</div>'
            f'</details>'
            f'<div class="result-meta">{meta_html}</div>'
            f'<div class="result-snippet">{snippet}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

        pdf_data = get_pdf_bytes(file_name)
        if pdf_data:
            st.download_button(
                f"\U0001f4c4 Open PDF \u2014 {title_text}",
                data=pdf_data, file_name=file_name,
                mime="application/pdf", key=f"d_{i}",
            )

elif _is_search_page:
    st.markdown("Search across 43 Don Bosco documents \u2014 letters, guidelines, memoirs, and more.")


# ============================================================
# KNOWLEDGE GRAPH PAGE
# ============================================================
elif _page == "\U0001f578\ufe0f Knowledge Graph":
    st.markdown("### Knowledge Graph Overview")
    st.markdown("""
    The **GSDP Knowledge Graph** is a structured semantic network automatically built from 43 historical
    Salesian documents (1754-1890). It connects *people*, *places*, *organizations*, and *events* mentioned
    across Don Bosco's letters, memoirs, and regulations into a queryable graph grounded in a formal OWL ontology.

    **What this enables:**
    - **Semantic Search** &mdash; Find documents by meaning, not just keywords
    - **Entity Resolution** &mdash; Recognize that 'Fr John Bosco', 'Don Bosco', and 'Giovanni Bosco' refer to the same person
    - **Relationship Discovery** &mdash; Trace who wrote to whom, where events happened, and how people are connected
    - **Temporal Analysis** &mdash; Navigate the corpus along a historical timeline (124 normalized dates)
    - **Ontology Grounding** &mdash; Every entity is linked to a formal concept, enabling machine reasoning
    """, unsafe_allow_html=True)

    # Entity stats with detailed breakdown
    kg_stats = cached_query("""
        SELECT
            (SELECT COUNT(*) FROM gsdp_poc.gold.dim_entities) AS total_entities,
            (SELECT COUNT(*) FROM gsdp_poc.gold.fact_entity_relationships) AS total_relationships,
            (SELECT COUNT(*) FROM gsdp_poc.raw.silver_entity_ontology_links) AS ontology_links,
            (SELECT COUNT(DISTINCT entity_name) FROM gsdp_poc.raw.silver_entity_ontology_links) AS linked_entities,
            (SELECT COUNT(*) FROM gsdp_poc.raw.entity_coreferences) AS coreferences,
            (SELECT COUNT(*) FROM gsdp_poc.raw.sdb6_ontology_nodes) AS ontology_nodes,
            (SELECT COUNT(DISTINCT match_type) FROM gsdp_poc.raw.silver_entity_ontology_links) AS match_strategies,
            (SELECT COUNT(*) FROM gsdp_poc.raw.entity_aliases) AS total_aliases,
            (SELECT COUNT(*) FROM gsdp_poc.gold.dim_dates) AS total_dates,
            (SELECT COUNT(*) FROM gsdp_poc.gold.dim_topics) AS total_topics,
            (SELECT COUNT(*) FROM gsdp_poc.gold.dim_documents) AS total_documents,
            (SELECT SUM(mention_count) FROM gsdp_poc.gold.dim_entities) AS total_mentions
    """)
    if "error" not in kg_stats.columns and len(kg_stats) > 0:
        r = kg_stats.iloc[0]
        total_ent = int(r.get("total_entities", 0))
        linked_ent = int(r.get("linked_entities", 0))
        total_rel = int(r.get("total_relationships", 0))
        total_mentions = int(r.get("total_mentions", 0))
        ontology_nodes = int(r.get("ontology_nodes", 0))
        ontology_links = int(r.get("ontology_links", 0))
        coreferences = int(r.get("coreferences", 0))
        total_aliases = int(r.get("total_aliases", 0))
        total_dates = int(r.get("total_dates", 0))
        total_topics = int(r.get("total_topics", 0))
        total_docs = int(r.get("total_documents", 0))
        strategies = int(r.get("match_strategies", 0))
        link_pct = round(linked_ent * 100 / total_ent, 1) if total_ent > 0 else 0

        # Metric cards row 1
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("\U0001f464 Entities", f"{total_ent:,}")
        c2.metric("\U0001f517 Relationships", f"{total_rel:,}")
        c3.metric("\U0001f3db\ufe0f Ontology Nodes", f"{ontology_nodes:,}")
        c4.metric("\U0001f4ac Mentions", f"{total_mentions:,}")
        # Metric cards row 2
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("\U0001f4c4 Documents", f"{total_docs:,}")
        c2.metric("\U0001f3f7\ufe0f Topics", f"{total_topics:,}")
        c3.metric("\U0001f310 Ontology Links", f"{ontology_links:,}")
        c4.metric("\U0001f504 Coreferences", f"{coreferences:,}")
        # Metric cards row 3
        c1, c2, c3, _ = st.columns(4)
        c1.metric("\U0001f500 Aliases", f"{total_aliases:,}")
        c2.metric("\U0001f4c5 Dates", f"{total_dates:,}")
        c3.metric("\U0001f9e9 Strategies", f"{strategies}")

    st.markdown("---")
    st.markdown("#### Detailed Breakdown per Metric")
    st.caption("Click each section below to see the full data table and explanation.")

    # --- Expandable detail sections with descriptions + sample data + tables ---
    with st.expander("\U0001f464 Entities \u2014 Unique named entities extracted by AI", expanded=False):
        st.markdown("""
        **What are Entities?** Every unique person, place, organization, or event that our AI pipeline
        automatically identified from the 43 source documents. These are the **nodes** (dots) in the
        knowledge graph. Each entity is classified by type and tracked by how often it appears.

        **How it works:** The pipeline reads each page, sends text to a foundation model (Llama 3.3 70B),
        and extracts structured entities with confidence scores.

        **Sample entities from the corpus:**
        | Entity | Type | Mentions | Example Context |
        |--------|------|----------|----------------|
        | Don Bosco | named_individual | 7,150 | Central figure across all documents |
        | Turin | location | 1,872 | City where the Oratory was founded |
        | Salesian Order | organization | 1,867 | The religious society Don Bosco founded |
        | Jesus Christ | person | 540 | Referenced in spiritual writings |
        | Foundation of Oratory | event | 12 | Key historical event |
        """)
        st.markdown("**Breakdown by entity type:**")
        ent_detail = cached_query("""
            SELECT entity_type, COUNT(*) AS count, SUM(mention_count) AS total_mentions
            FROM gsdp_poc.gold.dim_entities
            GROUP BY entity_type ORDER BY count DESC
        """)
        if "error" not in ent_detail.columns:
            st.dataframe(ent_detail, use_container_width=True, hide_index=True)
        st.markdown("**Sample entity records (top 10 by mentions):**")
        ent_samples = cached_query("""
            SELECT entity_name, entity_type, mention_count, source_files
            FROM gsdp_poc.gold.dim_entities
            ORDER BY mention_count DESC LIMIT 10
        """)
        if "error" not in ent_samples.columns:
            st.dataframe(ent_samples, use_container_width=True, hide_index=True)

    with st.expander("\U0001f517 Relationships \u2014 Typed connections between entities", expanded=False):
        st.markdown("""
        **What are Relationships?** Typed, directional connections between two entities that describe
        HOW they relate. These are the **edges** (lines) in the knowledge graph.

        **How it works:** Two methods: (1) Deterministic rules extract `wrote_to` and `wrote_from` from
        letter metadata; (2) LLM reads sub-documents and extracts predicates like `founded`, `visited`, `taught`.

        **Sample relationships:**
        | Subject | Predicate | Object |
        |---------|-----------|--------|
        | Don Bosco | wrote_to | Pope Pius IX |
        | Don Bosco | founded | Salesian Society |
        | Turin | LocatedInCountry | Italy |
        | Michael Rua | co_occurs_with | Don Bosco |
        | Italy | LocatedInContinent | Europe |
        """)
        st.markdown("**All relationship types in the graph:**")
        rel_detail = cached_query("""
            SELECT relationship_predicate, COUNT(*) AS count
            FROM gsdp_poc.gold.fact_entity_relationships
            GROUP BY relationship_predicate ORDER BY count DESC
        """)
        if "error" not in rel_detail.columns:
            st.dataframe(rel_detail, use_container_width=True, hide_index=True)
        st.markdown("**Sample relationship records (10 rows):**")
        rel_samples = cached_query("""
            SELECT s.entity_name AS subject, r.relationship_predicate, o.entity_name AS object
            FROM gsdp_poc.gold.fact_entity_relationships r
            JOIN gsdp_poc.gold.dim_entities s ON r.subject_entity_id = s.entity_id
            JOIN gsdp_poc.gold.dim_entities o ON r.object_entity_id = o.entity_id
            WHERE r.relationship_predicate != 'co_occurs_with'
            LIMIT 10
        """)
        if "error" not in rel_samples.columns:
            st.dataframe(rel_samples, use_container_width=True, hide_index=True)

    with st.expander("\U0001f3db\ufe0f Ontology Nodes \u2014 Formal knowledge model (OWL)", expanded=False):
        st.markdown("""
        **What is the Ontology?** A formal schema that defines WHAT types of things can exist in the
        Salesian domain and HOW they relate. Think of it as the "blueprint" for the knowledge graph.

        **Structure:** Built from the SDB6 OWL ontology file, then enriched by the pipeline:
        - **Classes** (172): Person, Location, Letter, Sermon, SalesianHouse, etc.
        - **Named Individuals** (291): Pre-defined entities like Don_Bosco, Turin, SalesianSociety
        - **Properties** (128): Defines allowed relationships (wrote_to, founded_in, etc.)
        - **Pipeline additions** (45): Geo-enrichment (26 cities), historical figures (14), auto-promoted (5)

        **Sample ontology nodes:**
        | Node | Category | Source |
        |------|----------|--------|
        | Person | class | Base Ontology |
        | Don_Bosco | named_individual | Base Ontology |
        | Turin | named_individual | geo_enrichment |
        | Jesus_Christ | named_individual | pipeline_expansion |
        | Dominic_Savio | named_individual | auto_promoted |
        """)
        st.markdown("**Breakdown by source and category:**")
        onto_detail = cached_query("""
            SELECT
                CASE WHEN source_path LIKE '%sdb6%' THEN 'Base Ontology (sdb6)'
                     ELSE source_path END AS source,
                entity_category, COUNT(*) AS count
            FROM gsdp_poc.raw.sdb6_ontology_nodes
            GROUP BY 1, entity_category ORDER BY count DESC
        """)
        if "error" not in onto_detail.columns:
            st.dataframe(onto_detail, use_container_width=True, hide_index=True)
        st.markdown("**Sample ontology node records (10 rows):**")
        onto_samples = cached_query("""
            SELECT entity_name, entity_category, source_path,
                   COALESCE(parent_class, '-') AS parent_class
            FROM gsdp_poc.raw.sdb6_ontology_nodes
            ORDER BY entity_category, entity_name
            LIMIT 10
        """)
        if "error" not in onto_samples.columns:
            st.dataframe(onto_samples, use_container_width=True, hide_index=True)

    with st.expander("\U0001f4c4 Documents \u2014 Source PDFs from Salesian corpus", expanded=False):
        st.markdown("""
        **What are the source documents?** 43 PDFs from the Salesian Historical Institute containing
        Don Bosco's personal letters, house regulations, spiritual writings, sermons, and memoirs.

        **Processing pipeline:** Each PDF is parsed page-by-page, then segmented into 352 sub-documents
        (individual letters within a collection, chapters within a book, etc.) for fine-grained search.

        **Sample documents:**
        | File | Type | Author | Date | Location |
        |------|------|--------|------|----------|
        | Bosco-1.8.1-Letter-To-Pope-Pius-IX.pdf | Letter | Don Bosco | 1867-03-12 | Turin |
        | Bosco-2.1.1-Regulations-Salesian-Houses.pdf | Regulation | Don Bosco | 1877 | Turin |
        | Bosco-3.2.1-Memoirs-Of-The-Oratory.pdf | Memoir | Don Bosco | 1854 | Turin |
        """)
        st.markdown("**Document types in the corpus:**")
        doc_detail = cached_query("""
            SELECT doc_type, COUNT(*) AS count, COUNT(DISTINCT author) AS authors,
                   MIN(CAST(doc_date AS STRING)) AS earliest,
                   MAX(CAST(doc_date AS STRING)) AS latest
            FROM gsdp_poc.gold.dim_documents
            GROUP BY doc_type ORDER BY count DESC
        """)
        if "error" not in doc_detail.columns:
            st.dataframe(doc_detail, use_container_width=True, hide_index=True)
        st.markdown("**Sample document records (10 rows):**")
        doc_samples = cached_query("""
            SELECT title, doc_type, author, CAST(doc_date AS STRING) AS date
            FROM gsdp_poc.gold.dim_documents
            ORDER BY doc_date
            LIMIT 10
        """)
        if "error" not in doc_samples.columns:
            st.dataframe(doc_samples, use_container_width=True, hide_index=True)

    with st.expander("\U0001f3f7\ufe0f Topics \u2014 Thematic categories assigned by AI", expanded=False):
        st.markdown("""
        **What are Topics?** Thematic labels automatically assigned to each document by the AI.
        They enable filtering search results by subject area.

        **How it works:** The LLM reads document content and assigns 1-3 topic labels from a
        controlled vocabulary. Topics link to ontology classes where possible.

        **Example topic assignments:**
        | Document | Topics Assigned |
        |----------|----------------|
        | Letter to Pope Pius IX (1867) | Religion, Catholic Church |
        | Regulations for Salesian Houses | Education, Salesian Work |
        | Memoir of the Oratory | Don Bosco, Spiritual Life |
        | Sermon on the Preventive System | Education, Charity |
        """)
        st.markdown("**Top 20 topics by document count:**")
        topic_detail = cached_query("""
            SELECT topic_name, document_count
            FROM gsdp_poc.gold.dim_topics
            ORDER BY document_count DESC LIMIT 20
        """)
        if "error" not in topic_detail.columns:
            st.dataframe(topic_detail, use_container_width=True, hide_index=True)
        st.markdown("**Sample: Documents per topic (top 5 topics):**")
        topic_docs = cached_query("""
            SELECT t.topic_name, d.title AS document_title, d.doc_type
            FROM gsdp_poc.gold.dim_topics t
            JOIN gsdp_poc.gold.fact_document_entities fde ON fde.document_id = (
                SELECT document_id FROM gsdp_poc.gold.dim_documents LIMIT 1
            )
            JOIN gsdp_poc.gold.dim_documents d ON d.document_id = fde.document_id
            WHERE t.document_count >= 8
            ORDER BY t.document_count DESC, t.topic_name
            LIMIT 10
        """)
        if "error" not in topic_docs.columns:
            st.dataframe(topic_docs, use_container_width=True, hide_index=True)

    with st.expander("\U0001f4ac Total Mentions \u2014 Entity importance by frequency", expanded=False):
        st.markdown("""
        **What does this measure?** The cumulative count of every time an entity name appears
        across all pages of all documents. Higher mention count = more central to the corpus.

        **Why it matters:** Mention frequency drives:
        - Entity hub ranking in the knowledge graph
        - Search result boosting (more-mentioned entities rank higher)
        - Auto-promotion threshold (5+ mentions with high confidence = auto-added to ontology)

        **Interpretation:** Don Bosco dominates (7,150 mentions) because he is the subject of every document.
        Publisher locations (Bengaluru, Krishnarajapuram) appear in headers/footers of every page.
        """)
        st.markdown("**Top 20 entities by mention count:**")
        mention_detail = cached_query("""
            SELECT entity_name, entity_type, mention_count
            FROM gsdp_poc.gold.dim_entities
            ORDER BY mention_count DESC LIMIT 20
        """)
        if "error" not in mention_detail.columns:
            st.dataframe(mention_detail, use_container_width=True, hide_index=True)

    with st.expander("\U0001f310 Ontology Links \u2014 Entity-to-ontology mappings", expanded=False):
        st.markdown(f"""
        **What are Ontology Links?** Verified connections between an extracted entity and a formal
        ontology concept. When an entity is "linked", the system **knows** its type and can reason about it.

        **Coverage:** Of {total_ent:,} total entities, **{linked_ent}** ({link_pct}%) are formally linked.
        The remaining entities are either too ambiguous, low-confidence, or not yet in the ontology.

        **Sample links:**
        | Entity (from text) | Matched To (in ontology) | Strategy | Confidence |
        |--------------------|--------------------------|----------|------------|
        | Don Bosco | Don_Bosco (named_individual) | exact | 0.90 |
        | Fr John Bosco | Don_Bosco (via alias) | alias | 0.85 |
        | SalesianCongregation | Salesian_Congregation | normalized | 0.85 |
        | The Oratory | Oratory | semantic | 0.89 |
        """)
        st.markdown("**Links by matching strategy:**")
        link_detail = cached_query("""
            SELECT match_type, COUNT(*) AS links,
                   COUNT(DISTINCT entity_name) AS unique_entities,
                   ROUND(AVG(confidence), 3) AS avg_confidence
            FROM gsdp_poc.raw.silver_entity_ontology_links
            GROUP BY match_type ORDER BY links DESC
        """)
        if "error" not in link_detail.columns:
            st.dataframe(link_detail, use_container_width=True, hide_index=True)
        st.markdown("**Sample ontology link records (10 rows):**")
        link_samples = cached_query("""
            SELECT entity_name, ontology_node_name, match_type,
                   ROUND(confidence, 3) AS confidence
            FROM gsdp_poc.raw.silver_entity_ontology_links
            ORDER BY confidence DESC
            LIMIT 10
        """)
        if "error" not in link_samples.columns:
            st.dataframe(link_samples, use_container_width=True, hide_index=True)

    with st.expander("\U0001f504 Coreferences \u2014 Resolved indirect mentions", expanded=False):
        st.markdown("""
        **What is Coreference Resolution?** When a document says "the founder" or "his holiness"
        instead of using a proper name, the system identifies WHO is actually being referred to.

        **Two methods:**
        - **Rule-based** (310 resolutions): Deterministic patterns like "the founder" = Don Bosco,
          "his holiness" = Pius IX, "the Blessed Virgin" = Mary
        - **LLM-based** (71 resolutions): Context-dependent resolution where the AI reads surrounding
          text to determine who a pronoun or description refers to

        **Sample resolutions:**
        | Mention in Text | Resolved To | Method | Context |
        |-----------------|-------------|--------|---------|
        | "the founder" | Don Bosco | rule_based | "The founder established the first oratory..." |
        | "his holiness" | Pius IX | rule_based | "His holiness granted the audience..." |
        | "the rector" | Don Bosco | rule_based | "The rector addressed the young men..." |
        | "the archbishop" | Lorenzo Gastaldi | llm | "The archbishop of Turin wrote to..." |
        """)
        st.markdown("**By method:**")
        coref_method = cached_query("""
            SELECT method, COUNT(*) AS count, COUNT(DISTINCT resolved_entity) AS unique_targets
            FROM gsdp_poc.raw.entity_coreferences
            GROUP BY method ORDER BY count DESC
        """)
        if "error" not in coref_method.columns:
            st.dataframe(coref_method, use_container_width=True, hide_index=True)
        st.markdown("**Top resolved targets:**")
        coref_targets = cached_query("""
            SELECT resolved_entity, COUNT(*) AS mentions
            FROM gsdp_poc.raw.entity_coreferences
            GROUP BY resolved_entity ORDER BY mentions DESC LIMIT 10
        """)
        if "error" not in coref_targets.columns:
            st.dataframe(coref_targets, use_container_width=True, hide_index=True)
        st.markdown("**Sample coreference records (10 rows):**")
        coref_samples = cached_query("""
            SELECT original_mention, resolved_entity, method, source_file
            FROM gsdp_poc.raw.entity_coreferences
            ORDER BY resolved_entity
            LIMIT 10
        """)
        if "error" not in coref_samples.columns:
            st.dataframe(coref_samples, use_container_width=True, hide_index=True)

    with st.expander("\U0001f500 Entity Aliases \u2014 Name variant mappings", expanded=False):
        st.markdown("""
        **What are Entity Aliases?** Mappings that tell the system different name spellings refer
        to the same real-world entity. Critical for accurate search and deduplication.

        **Two sources:**
        - **LLM clustering** (83 aliases): AI groups similar names from extracted entities
        - **Manual curation** (31 aliases): Hand-verified mappings for known variants

        **Sample alias mappings:**
        | Raw Name (as found in text) | Canonical Name | Type |
        |-----------------------------|----------------|------|
        | Fr John Bosco | Don Bosco | person |
        | Giovanni Bosco | Don Bosco | person |
        | G. Bosco | Don Bosco | person |
        | Don_Bosco | Don Bosco | person |
        | Salesian Order | SalesiansOfDonBosco | organization |
        | Pious Salesian Society | SalesiansOfDonBosco | organization |
        | Torino | Turin | location |
        """)
        st.markdown("**Aliases by type and method:**")
        alias_detail = cached_query("""
            SELECT entity_type, method, COUNT(*) AS count,
                   COUNT(DISTINCT canonical_name) AS canonical_targets
            FROM gsdp_poc.raw.entity_aliases
            GROUP BY entity_type, method ORDER BY count DESC
        """)
        if "error" not in alias_detail.columns:
            st.dataframe(alias_detail, use_container_width=True, hide_index=True)
        st.markdown("**Sample alias records (10 rows):**")
        alias_samples = cached_query("""
            SELECT raw_name, canonical_name, entity_type, method,
                   ROUND(confidence, 2) AS confidence
            FROM gsdp_poc.raw.entity_aliases
            ORDER BY canonical_name, raw_name
            LIMIT 10
        """)
        if "error" not in alias_samples.columns:
            st.dataframe(alias_samples, use_container_width=True, hide_index=True)

    with st.expander("\U0001f4c5 Normalized Dates \u2014 Timeline dimension", expanded=False):
        st.markdown("""
        **What are Normalized Dates?** Date references extracted from document text and standardized
        to ISO format, enabling timeline-based queries and temporal analysis.

        **Parsing handles multiple formats:**
        - "12 August 1881" &rarr; 1881-08-12 (day precision)
        - "December 1875" &rarr; 1875-12-01 (month precision)
        - "1841" &rarr; 1841 (year precision)

        **Sample normalized dates:**
        | Raw Value (from text) | ISO Date | Year | Precision | Mentions |
        |-----------------------|----------|------|-----------|----------|
        | 12 August 1881 | 1881-08-12 | 1881 | day | 3 |
        | 1875 | - | 1875 | year | 8 |
        | December 7, 1884 | 1884-12-07 | 1884 | day | 2 |
        | June 1856 | 1856-06-01 | 1856 | month | 1 |
        """)
        st.markdown("**Dates by precision level:**")
        date_detail = cached_query("""
            SELECT date_precision, COUNT(*) AS count,
                   MIN(year) AS min_year, MAX(year) AS max_year,
                   SUM(mention_count) AS total_mentions
            FROM gsdp_poc.gold.dim_dates
            GROUP BY date_precision ORDER BY count DESC
        """)
        if "error" not in date_detail.columns:
            st.dataframe(date_detail, use_container_width=True, hide_index=True)
        st.markdown("**Sample date records (10 rows):**")
        date_samples = cached_query("""
            SELECT raw_value, iso_date, year, date_precision, mention_count
            FROM gsdp_poc.gold.dim_dates
            ORDER BY year DESC
            LIMIT 10
        """)
        if "error" not in date_samples.columns:
            st.dataframe(date_samples, use_container_width=True, hide_index=True)

    with st.expander("\U0001f9e9 Match Strategies \u2014 5 algorithms for entity linking", expanded=False):
        st.markdown("""
        **What are Match Strategies?** The 5 different algorithms the pipeline uses to link
        extracted entities to formal ontology concepts. They run in sequence, from simplest to most
        sophisticated, so each entity gets the best possible match.

        **The 5 strategies (in order):**
        | # | Strategy | How it works | Example |
        |---|----------|--------------|----------|
        | 1 | **Exact** | Case-insensitive string match with underscore normalization | "Don Bosco" matches "Don_Bosco" |
        | 2 | **Normalized** | Strip ALL non-alphanumeric characters, compare | "SalesianCongregation" matches "Salesian Congregation" |
        | 3 | **Alias** | Resolve via entity_aliases table first, then match canonical name | "Fr John Bosco" &rarr; "Don Bosco" &rarr; "Don_Bosco" |
        | 4 | **Geo-hierarchy** | Match against geographic parent-child tree | "Piedmont" matches via Italy &rarr; Piedmont |
        | 5 | **Semantic** | AI embedding cosine similarity > 0.85 threshold | "The Oratory" matches "Oratory" (0.89) |
        """)
        st.markdown("**Performance by strategy:**")
        strat_detail = cached_query("""
            SELECT match_type AS strategy, COUNT(*) AS links,
                   COUNT(DISTINCT entity_name) AS entities,
                   ROUND(AVG(confidence), 3) AS avg_confidence,
                   ROUND(MIN(confidence), 3) AS min_confidence,
                   ROUND(MAX(confidence), 3) AS max_confidence
            FROM gsdp_poc.raw.silver_entity_ontology_links
            GROUP BY match_type ORDER BY links DESC
        """)
        if "error" not in strat_detail.columns:
            st.dataframe(strat_detail, use_container_width=True, hide_index=True)
        st.markdown("**Sample: One link per strategy (showing how each works):**")
        strat_samples = cached_query("""
            WITH ranked AS (
                SELECT entity_name, ontology_node_name, match_type,
                       ROUND(confidence, 3) AS confidence,
                       ROW_NUMBER() OVER (PARTITION BY match_type ORDER BY confidence DESC) AS rn
                FROM gsdp_poc.raw.silver_entity_ontology_links
            )
            SELECT entity_name, ontology_node_name, match_type AS strategy, confidence
            FROM ranked WHERE rn <= 2
            ORDER BY CASE match_type
                WHEN 'exact' THEN 1 WHEN 'normalized' THEN 2
                WHEN 'alias' THEN 3 WHEN 'geo_hierarchy' THEN 4
                WHEN 'semantic' THEN 5 END, confidence DESC
        """)
        if "error" not in strat_samples.columns:
            st.dataframe(strat_samples, use_container_width=True, hide_index=True)

    st.markdown("---")

    # Top entities by relationship count
    st.markdown("#### Top 20 Entity Hubs (by relationship count)")
    top_entities = cached_query("""
        SELECT e.entity_name, e.entity_type,
               COUNT(*) AS relationship_count
        FROM gsdp_poc.gold.fact_entity_relationships r
        JOIN gsdp_poc.gold.dim_entities e ON r.subject_entity_id = e.entity_id
        GROUP BY e.entity_name, e.entity_type
        ORDER BY relationship_count DESC
        LIMIT 20
    """)
    if "error" not in top_entities.columns:
        st.bar_chart(top_entities.set_index("entity_name")["relationship_count"])

    # Matching strategy breakdown
    st.markdown("#### Ontology Matching Strategies")
    strategies = cached_query("""
        SELECT match_type, COUNT(*) AS links, COUNT(DISTINCT entity_name) AS entities
        FROM gsdp_poc.raw.silver_entity_ontology_links
        GROUP BY match_type
        ORDER BY links DESC
    """)
    if "error" not in strategies.columns:
        st.dataframe(strategies, use_container_width=True, hide_index=True)

    # Timeline from dim_dates
    st.markdown("#### Document Timeline")
    timeline = cached_query("""
        SELECT year, date_precision, COUNT(*) AS date_mentions,
               SUM(mention_count) AS total_mentions
        FROM gsdp_poc.gold.dim_dates
        WHERE year BETWEEN 1800 AND 1900
        GROUP BY year, date_precision
        ORDER BY year
    """)
    if "error" not in timeline.columns and len(timeline) > 0:
        st.bar_chart(timeline.set_index("year")["total_mentions"])
    else:
        st.info("No timeline data available yet. Run Task 2.6 to populate dim_dates.")

    # Entity Type Distribution
    st.markdown("#### Entity Type Distribution")
    type_dist = cached_query("""
        SELECT entity_type, COUNT(*) AS count
        FROM gsdp_poc.gold.dim_entities
        WHERE entity_type IS NOT NULL
        GROUP BY entity_type
        ORDER BY count DESC
    """)
    if "error" not in type_dist.columns and len(type_dist) > 0:
        st.bar_chart(type_dist.set_index("entity_type")["count"])

    # Relationship Predicates
    st.markdown("#### Top Relationship Types")
    predicates = cached_query("""
        SELECT predicate, COUNT(*) AS count
        FROM gsdp_poc.gold.fact_entity_relationships
        GROUP BY predicate
        ORDER BY count DESC
        LIMIT 15
    """)
    if "error" not in predicates.columns and len(predicates) > 0:
        st.bar_chart(predicates.set_index("predicate")["count"])

    # Ontology Coverage
    st.markdown("#### Ontology Coverage")
    coverage = cached_query("""
        WITH all_entities AS (
            SELECT DISTINCT entity_name FROM gsdp_poc.raw.bronze_extracted_entities
            WHERE entity_name IS NOT NULL AND LENGTH(TRIM(entity_name)) > 1
        ),
        linked AS (
            SELECT DISTINCT entity_name FROM gsdp_poc.raw.silver_entity_ontology_links
        )
        SELECT
            COUNT(*) AS total_unique_entities,
            SUM(CASE WHEN l.entity_name IS NOT NULL THEN 1 ELSE 0 END) AS linked_to_ontology,
            SUM(CASE WHEN l.entity_name IS NULL THEN 1 ELSE 0 END) AS unlinked
        FROM all_entities a
        LEFT JOIN linked l ON a.entity_name = l.entity_name
    """)
    if "error" not in coverage.columns and len(coverage) > 0:
        r = coverage.iloc[0]
        total = int(r.get("total_unique_entities", 0))
        linked = int(r.get("linked_to_ontology", 0))
        unlinked = int(r.get("unlinked", 0))
        pct = round(linked * 100 / total, 1) if total > 0 else 0
        c1, c2, c3 = st.columns(3)
        c1.metric("Total Unique Entities", total)
        c2.metric("Linked to Ontology", f"{linked} ({pct}%)")
        c3.metric("Unlinked", unlinked)

    # Topic Map
    st.markdown("#### Topic Distribution")
    topics = cached_query("""
        SELECT topic_name, document_count, entity_count
        FROM gsdp_poc.gold.dim_topics
        ORDER BY document_count DESC
        LIMIT 20
    """)
    if "error" not in topics.columns and len(topics) > 0:
        st.bar_chart(topics.set_index("topic_name")["document_count"])

    st.markdown("---")

    # Entity Aliases
    st.markdown("#### Entity Alias Mappings")
    aliases = cached_query("""
        SELECT raw_name, canonical_name, entity_type, source
        FROM gsdp_poc.raw.entity_aliases
        ORDER BY canonical_name, raw_name
    """)
    if "error" not in aliases.columns and len(aliases) > 0:
        st.caption(f"{len(aliases)} alias mappings")
        st.dataframe(aliases, use_container_width=True, hide_index=True)

    # Semantic Match Candidates
    st.markdown("#### Semantic Match Candidates")
    sem_matches = cached_query("""
        SELECT entity_name, matched_ontology_node,
               ROUND(similarity_score, 4) AS score, status
        FROM gsdp_poc.raw.semantic_match_candidates
        ORDER BY status, similarity_score DESC
    """)
    if "error" not in sem_matches.columns and len(sem_matches) > 0:
        st.dataframe(sem_matches, use_container_width=True, hide_index=True)
    else:
        st.info("No semantic matches yet. Run Task 11 to generate.")

    # Entity coreference samples
    st.markdown("#### Coreference Resolutions")
    corefs = cached_query("""
        SELECT mention_text, resolved_entity, method,
               ROUND(confidence, 2) AS confidence, context_snippet
        FROM gsdp_poc.raw.entity_coreferences
        ORDER BY resolved_at DESC
        LIMIT 20
    """)
    if "error" not in corefs.columns and len(corefs) > 0:
        st.dataframe(corefs, use_container_width=True, hide_index=True)

    st.markdown("---")

    # Entity Explorer
    st.markdown("#### Entity Explorer")
    entity_search = st.text_input("Search entities", placeholder="Type an entity name...", key="kg_entity_search")
    if entity_search and len(entity_search) >= 2:
        entity_results = cached_query(f"""
            SELECT e.entity_name, e.entity_type, e.mention_count,
                   l.matched_entity_id, l.match_type
            FROM gsdp_poc.gold.dim_entities e
            LEFT JOIN gsdp_poc.raw.silver_entity_ontology_links l
                ON e.entity_name = l.entity_name
            WHERE LOWER(e.entity_name) LIKE '%{entity_search.lower()}%'
            ORDER BY e.mention_count DESC
            LIMIT 25
        """)
        if "error" not in entity_results.columns and len(entity_results) > 0:
            st.dataframe(entity_results, use_container_width=True, hide_index=True)
        else:
            st.warning(f"No entities found matching '{entity_search}'")


# ============================================================
# PIPELINE HEALTH PAGE
# ============================================================
elif _page == "\u2699\ufe0f Pipeline":
    st.markdown("### Pipeline Health Dashboard")

    # Run log summary
    run_stats = cached_query("""
        SELECT
            COUNT(*) AS total_runs,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failures,
            ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS success_rate
        FROM gsdp_poc.raw.pipeline_run_log
    """)
    if "error" not in run_stats.columns and len(run_stats) > 0:
        r = run_stats.iloc[0]
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Runs", r.get("total_runs", 0))
        c2.metric("Successes", r.get("successes", 0))
        c3.metric("Failures", r.get("failures", 0))
        c4.metric("Success Rate", f"{r.get('success_rate', 0)}%")

    st.markdown("---")

    # Task-level breakdown
    st.markdown("#### Task Performance")
    task_stats = cached_query("""
        SELECT task_name,
               SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
               SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failures,
               MAX(run_ts) AS last_run,
               MAX(rows_affected) AS last_row_count
        FROM gsdp_poc.raw.pipeline_run_log
        GROUP BY task_name
        ORDER BY task_name
    """)
    if "error" not in task_stats.columns:
        st.dataframe(task_stats, use_container_width=True, hide_index=True)

    # Data lineage
    st.markdown("#### Data Lineage (Latest Run)")
    lineage = cached_query("""
        SELECT source_table, target_table,
               source_row_count, target_row_count,
               rows_added, rows_updated, task_name,
               ROUND(duration_seconds, 1) AS duration_s
        FROM gsdp_poc.raw.pipeline_lineage
        ORDER BY run_ts DESC
        LIMIT 20
    """)
    if "error" not in lineage.columns and len(lineage) > 0:
        st.dataframe(lineage, use_container_width=True, hide_index=True)
    else:
        st.info("No lineage data yet. Run Task 12 to populate.")

    # Search quality metrics
    st.markdown("#### Search Quality Validation")
    sq = cached_query("""
        SELECT query_text, query_category,
               ROUND(top_1_score, 3) AS top1_score,
               ROUND(top_3_avg_score, 3) AS top3_avg,
               top_1_file, expected_match,
               CAST(validated_at AS STRING) AS validated
        FROM gsdp_poc.raw.search_quality_log
        ORDER BY validated_at DESC
        LIMIT 20
    """)
    if "error" not in sq.columns and len(sq) > 0:
        avg_score = sq["top1_score"].astype(float).mean()
        match_rate = sq["expected_match"].apply(lambda x: x == "true" or x is True).mean()
        c1, c2 = st.columns(2)
        c1.metric("Avg Top-1 Score", f"{avg_score:.3f}")
        c2.metric("Expected Match Rate", f"{match_rate:.0%}")
        st.dataframe(sq, use_container_width=True, hide_index=True)
    else:
        st.info("No search quality data yet. Run Task 9 to validate.")

    # Recent failures
    st.markdown("#### Recent Failures")
    failures = cached_query("""
        SELECT task_name, run_ts, error_message
        FROM gsdp_poc.raw.pipeline_run_log
        WHERE status = 'failed'
        ORDER BY run_ts DESC
        LIMIT 10
    """)
    if "error" not in failures.columns and len(failures) > 0:
        st.dataframe(failures, use_container_width=True, hide_index=True)
    else:
        st.success("No recent failures!")
