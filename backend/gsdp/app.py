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
from databricks.sdk import WorkspaceClient
from config import APP_TITLE, APP_ICON, MAX_SEARCH_RESULTS

st.set_page_config(page_title=APP_TITLE, page_icon=APP_ICON, layout="wide")

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
}
.result-odd {
    background: #f9faf9;
    padding: 14px 18px;
    border-radius: 8px;
    margin-bottom: 6px;
    border-left: 4px solid #34a853;
}
.result-title {
    font-size: 17px;
    font-weight: 600;
    color: #1a0dab;
    margin-bottom: 2px;
}
.result-meta {
    font-size: 12px;
    color: #5f6368;
    margin-bottom: 6px;
}
.result-snippet {
    font-size: 13.5px;
    color: #3c4043;
    line-height: 1.55;
}
.result-snippet b {
    color: #202124;
    background: #fff3cd;
    padding: 0 2px;
    border-radius: 2px;
}
.score-bar {
    display: inline-block;
    height: 6px;
    border-radius: 3px;
    margin-right: 8px;
    vertical-align: middle;
}

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


@st.cache_data(ttl=120, show_spinner=False)
def do_search(query_text: str, num_results: int, enable_reranking: bool, enable_expansion: bool):
    from search_backend import query_don_bosco
    return query_don_bosco(
        query_text,
        num_results=num_results,
        enable_reranking=enable_reranking,
        enable_expansion=enable_expansion,
    )


def format_title(filename):
    if not filename:
        return "Unknown Document", ""
    import re
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
    import re
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

with st.form("search_form", clear_on_submit=False):
    query = st.text_input("Search", placeholder="Search Don Bosco documents...",
                          label_visibility="collapsed")
    submitted = st.form_submit_button("Search", use_container_width=True)
    enable_reranking = True
    enable_expansion = True

if submitted and query:
    st.session_state["last_query"] = query

active_query = st.session_state.get("last_query", "")
active_rerank = True
active_expand = True

if active_query:
    with st.spinner("Searching..."):
        result = do_search(active_query, MAX_SEARCH_RESULTS, active_rerank, active_expand)
    sources = result.get("sources", [])
    diagnostics = result.get("diagnostics", {})

    total_ms = diagnostics.get("total_latency_ms", 0)
    st.caption(f"About {len(sources)} results  •  {total_ms} ms")

    answer = result.get("answer", "")
    if answer:
        st.info(answer)
        # PDF download links for source documents cited in the answer
        seen_files = set()
        source_pdfs = []
        for src in sources[:5]:
            fn = src.get("file_name", "")
            if fn and fn not in seen_files:
                seen_files.add(fn)
                source_pdfs.append(fn)
        if source_pdfs:
            st.markdown("**📎 Source Documents:**")
            cols = st.columns(min(len(source_pdfs), 3))
            for idx, fn in enumerate(source_pdfs):
                title, _ = format_title(fn)
                pdf_bytes = get_pdf_bytes(fn)
                if pdf_bytes:
                    cols[idx % 3].download_button(
                        f"📄 {title}",
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

        snippet = get_meaningful_snippet(content_text, active_query)

        final_score = float(s.get("final_score", 0))

        path_parts = [p for p in [f"\u00a7{section}" if section else "", doc_type, doc_date] if p]
        meta_parts = [" \u203a ".join(path_parts)]
        meta_parts.append(f"\U0001f3af {final_score*100:.0f}%")
        if author:
            meta_parts.append(f"\u270d\ufe0f {author}")
        if recipient:
            meta_parts.append(f"\u2192 {recipient}")
        if location:
            meta_parts.append(f"\U0001f4cd {location}")
        meta_str = "  \u2022  ".join(meta_parts)

        card_class = "result-even" if i % 2 == 0 else "result-odd"

        st.markdown(
            f'<div class="{card_class}">'
            f'<div class="result-title">{title_text}</div>'
            f'<div class="result-meta">{meta_str}</div>'
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

else:
    st.markdown("Search across 43 Don Bosco documents \u2014 letters, guidelines, memoirs, and more.")
    st.markdown("---")

    stats = get_corpus_stats()
    if "error" not in stats.columns and len(stats) > 0:
        r = stats.iloc[0]
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Documents", r.get("total_documents", 0))
        c2.metric("Authors", r.get("authors", 0))
        c3.metric("Date Range", f"{r.get('earliest', '?')} \u2013 {r.get('latest', '?')}")
        c4.metric("Types", r.get("types", 0))

    docs = get_documents_list()
    if "error" not in docs.columns:
        st.markdown("### All Documents")
        st.dataframe(docs, use_container_width=True, hide_index=True)
