""" 
GSDP Semantic Search — RAG assistant over multilingual educational content
(PDFs, audio, images, video).

This module can be loaded by ``backend/main.py`` (``mount_rag_gradio``) or 
run standalone with ``python app.py``.
"""

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
INDEX_NAME = os.environ.get("VECTOR_SEARCH_INDEX", "salesianonline.gold.vector_content_index")
LLM_ENDPOINT = os.environ.get("LLM_ENDPOINT", "databricks-meta-llama-3-3-70b-instruct")

# Get Databricks credentials from environment or use defaults
# In Databricks Apps, these are automatically provided
DATABRICKS_HOST = os.environ.get("DATABRICKS_HOST", 
                                 os.environ.get("DATABRICKS_SERVER_HOSTNAME", 
                                               "https://dbc-f99975de-9224.cloud.databricks.com"))
DATABRICKS_TOKEN = os.environ.get("DATABRICKS_TOKEN",
                                  os.environ.get("DATABRICKS_ACCESS_TOKEN", 
                                                "dapia5554ab24c1fa7f53da24f14fb0d7620"))


# ============================================================
# AUTHENTICATION
# ============================================================
def get_host():
    """Return the hardcoded Databricks host."""
    return DATABRICKS_HOST


def get_token():
    """Return the hardcoded personal access token."""
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
            "columns": ["file_name", "media_type_code", "language_code",
                        "content_density", "content_text"],
            "num_results": 10
        }
        if media_filter and media_filter != "All":
            search_kwargs["filters"] = {"media_type_code": media_filter.lower()}

        results = index.similarity_search(**search_kwargs)

        documents = []
        for row in results.get("result", {}).get("data_array", []):
            documents.append({
                "file_name": row[0],
                "media_type": row[1],
                "language": row[2],
                "density": row[3],
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
        icon = MEDIA_ICONS.get(doc["media_type"], "")
        context_parts.append(
            f"--- Source {i}: {icon} {doc['file_name']} "
            f"(Type: {doc['media_type']}, Language: {doc['language']}) ---\n"
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


def format_sources(docs):
    """Format source documents with icons."""
    if not docs or "error" in docs[0]:
        return "No sources retrieved."
    sources_md = ""
    for i, doc in enumerate(docs, 1):
        icon = MEDIA_ICONS.get(doc["media_type"], "")
        flag = LANGUAGE_FLAGS.get(doc["language"], LANGUAGE_FLAGS["UNKNOWN"])
        density_badge = "\U0001F7E2" if doc["density"] == "high" else "\U0001F7E1"
        sources_md += (
            f"**{i}. {icon} {doc['file_name']}**\n"
            f"   {flag} {doc['language']} \u2022 "
            f"{density_badge} {doc['density']} density \u2022 "
            f"{doc['media_type'].upper()}\n\n"
        )
    return sources_md


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
   GSDP Semantic Search — custom blue & white (overrides Gradio defaults)
   Palette: white #ffffff, ice #f8fafc / #f0f9ff, borders #bfdbfe / #dbeafe,
   text #0f172a / #1e3a8a, accents #0284c7 / #0369a1 / #0ea5e9
   ============================================================ */

.gradio-container {
    /* Gradio theme tokens */
    --body-background-fill: #eff6ff !important;
    --background-fill-primary: #ffffff !important;
    --background-fill-secondary: #f0f9ff !important;
    --border-color-primary: #bfdbfe !important;
    --body-text-color: #0f172a !important;
    --block-label-text-color: #1e3a8a !important;
    --block-title-text-color: #1e3a8a !important;
    --input-background-fill: #ffffff !important;
    --input-border-color: #bfdbfe !important;
    --button-primary-background-fill: #0284c7 !important;
    --button-primary-text-color: #ffffff !important;
    --checkbox-background-color: #ffffff !important;
    --checkbox-border-color: #93c5fd !important;
    color-scheme: light !important;

    max-width: 1200px !important;
    margin: auto !important;
    min-height: 100vh;
    padding: 1.25rem 1rem 2rem !important;
    font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important;
    background: linear-gradient(180deg, #dbeafe 0%, #eff6ff 22%, #ffffff 55%, #f8fafc 100%) !important;
    color: #0f172a !important;
}

.gradio-container .wrap,
.gradio-container .contain,
.gradio-container main {
    color: #0f172a !important;
}

.gradio-container .panel,
.gradio-container [class*="block"] {
    background: transparent !important;
}

/* Block labels — navy blue on white */
.gradio-container .label-wrap label,
.gradio-container label span {
    color: #1e3a8a !important;
    font-weight: 600 !important;
}

/* Inputs & textareas */
.gradio-container textarea,
.gradio-container input:not([type="checkbox"]):not([type="radio"]) {
    background: #ffffff !important;
    color: #0f172a !important;
    border: 1px solid #bfdbfe !important;
    border-radius: 10px !important;
    box-shadow: 0 1px 2px rgba(30, 58, 138, 0.04) !important;
}

.gradio-container textarea:focus,
.gradio-container input:focus {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
}

/* Dropdown */
.gradio-container .wrap_inner,
.gradio-container [class*="dropdown"] {
    color: #0f172a !important;
}

.gradio-container .options,
.gradio-container ul.options,
.gradio-container .options-wrap {
    background: #ffffff !important;
    border: 1px solid #bfdbfe !important;
    border-radius: 10px !important;
    box-shadow: 0 10px 40px -10px rgba(30, 58, 138, 0.2) !important;
}

/* Buttons */
.gradio-container button.primary,
.gradio-container .lg.primary {
    background: linear-gradient(135deg, #1d4ed8 0%, #0284c7 50%, #0ea5e9 100%) !important;
    color: #ffffff !important;
    border: 1px solid rgba(255, 255, 255, 0.35) !important;
    border-radius: 10px !important;
}

.gradio-container button.secondary {
    background: #ffffff !important;
    color: #1e3a8a !important;
    border: 1px solid #bfdbfe !important;
    border-radius: 10px !important;
}

.gradio-container button.secondary:hover {
    background: #eff6ff !important;
    border-color: #93c5fd !important;
}

.gradio-container input[type="radio"],
.gradio-container input[type="checkbox"] {
    accent-color: #0284c7 !important;
}

/* Radio row — light blue tint */
.gradio-container .radio-group,
.gradio-container fieldset {
    border-color: transparent !important;
}

/* Accordion (example questions) — native details + class hook */
.gradio-container details,
.gradio-container .rag-accordion,
.gradio-container .rag-accordion details {
    background: #ffffff !important;
    border: 1px solid #bfdbfe !important;
    border-radius: 14px !important;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(30, 58, 138, 0.06) !important;
}

.gradio-container summary,
.gradio-container .rag-accordion summary {
    color: #1e3a8a !important;
    font-weight: 600 !important;
    padding: 0.75rem 1rem !important;
    background: linear-gradient(90deg, #eff6ff 0%, #ffffff 100%) !important;
}

.gradio-container details[open] summary,
.gradio-container .rag-accordion details[open] summary {
    border-bottom: 1px solid #e0f2fe !important;
}

/* Markdown links inside answer */
.chat-area a,
.sources-panel a {
    color: #0284c7 !important;
}

/* --- Header hero (blue band, white text) --- */
.header-section {
    background: linear-gradient(125deg, #1e3a8a 0%, #1d4ed8 38%, #0369a1 72%, #0ea5e9 100%) !important;
    padding: 2rem 2.25rem !important;
    border-radius: 18px !important;
    margin-bottom: 1.25rem !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    box-shadow:
        0 4px 6px rgba(30, 58, 138, 0.15),
        0 20px 50px -12px rgba(2, 132, 199, 0.35) !important;
}

.header-section h1 {
    color: #ffffff !important;
    font-size: 1.8rem !important;
    font-weight: 700 !important;
    letter-spacing: -0.02em !important;
    margin: 0 !important;
}

.header-section p {
    color: rgba(255, 255, 255, 0.95) !important;
    font-size: 0.98rem !important;
    margin-top: 0.45rem !important;
    max-width: 48rem;
    line-height: 1.5 !important;
}

/* --- Controls strip --- */
.controls-row {
    background: #ffffff !important;
    border: 1px solid #bfdbfe !important;
    padding: 0.85rem 1.2rem !important;
    border-radius: 14px !important;
    margin-bottom: 0.9rem !important;
    box-shadow: 0 2px 8px rgba(30, 58, 138, 0.06) !important;
}

/* --- Language row --- */
.lang-section {
    background: linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%) !important;
    padding: 0.6rem 1rem !important;
    border-radius: 12px !important;
    margin-bottom: 0.65rem !important;
    border: 1px solid #bfdbfe !important;
}

.lang-section label {
    font-weight: 600 !important;
    color: #1e3a8a !important;
}

/* --- Answer card --- */
.chat-area {
    border: 1px solid #bfdbfe !important;
    border-radius: 14px !important;
    padding: 1.25rem 1.35rem !important;
    background: #ffffff !important;
    min-height: 200px !important;
    box-shadow: 0 4px 24px -8px rgba(30, 58, 138, 0.1) !important;
}

.chat-area .prose,
.chat-area p,
.chat-area li {
    color: #1e293b !important;
}

/* --- Sources column --- */
.sources-panel {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
    border: 1px solid #bfdbfe !important;
    border-radius: 14px !important;
    padding: 1.1rem 1.2rem !important;
    box-shadow: 0 2px 12px rgba(30, 58, 138, 0.07) !important;
}

.sources-panel h3 {
    color: #1e3a8a !important;
    font-weight: 700 !important;
    margin-top: 0 !important;
}

/* --- Primary CTA hook --- */
.primary-btn {
    background: linear-gradient(135deg, #1d4ed8 0%, #0284c7 50%, #0ea5e9 100%) !important;
    color: #ffffff !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
    font-weight: 600 !important;
    border-radius: 10px !important;
    box-shadow: 0 4px 16px rgba(2, 132, 199, 0.35) !important;
}

.primary-btn:hover {
    filter: brightness(1.06) !important;
    box-shadow: 0 8px 24px rgba(2, 132, 199, 0.4) !important;
}

/* --- Footer --- */
.footer {
    text-align: center;
    color: #64748b !important;
    padding: 1.1rem 0.5rem 0 !important;
    font-size: 0.78rem !important;
    border-top: 1px solid #bfdbfe !important;
    margin-top: 0.75rem !important;
    background: linear-gradient(180deg, transparent, #f0f9ff) !important;
    border-radius: 0 0 8px 8px !important;
}

/* --- Loading card (Markdown HTML) --- */
@keyframes rag-premium-spin {
    to { transform: rotate(360deg); }
}

.rag-premium-load {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.2rem;
    background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
    border: 1px solid #bfdbfe;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(30, 58, 138, 0.06);
}

.rag-premium-spin {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 3px solid #dbeafe;
    border-top-color: #0284c7;
    border-right-color: #38bdf8;
    animation: rag-premium-spin 0.72s linear infinite;
}

.rag-premium-load-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
}

.rag-premium-load-title {
    font-weight: 700;
    font-size: 1.02rem;
    color: #1e3a8a;
}

.rag-premium-load-hint {
    font-size: 0.88rem;
    color: #64748b;
    line-height: 1.45;
}

.progress-bar-wrap,
.generating {
    border-radius: 8px !important;
}
"""

EXAMPLE_QUERIES = [
    "What is the Preventive System methodology in Salesian education?",
    "Summarize the focus group guide content",
    "What topics are covered in the English audio recordings?",
    "Describe the questionnaire (Vademecum) structure",
    "What languages is the educational content available in?",
]


def create_app():
    """Build the Gradio application."""
    _theme = gr.themes.Soft(
        primary_hue=gr.themes.colors.blue,
        secondary_hue=gr.themes.colors.sky,
        neutral_hue=gr.themes.colors.slate,
        font=[gr.themes.GoogleFont("Inter"), "ui-sans-serif", "system-ui", "sans-serif"],
        radius_size=gr.themes.sizes.radius_lg,
    )
    try:
        _theme = _theme.set(
            body_background_fill="#eff6ff",
            block_background_fill="#ffffff",
            block_border_color="#bfdbfe",
            block_title_text_color="#1e3a8a",
            block_label_text_color="#1e3a8a",
            input_background_fill="#ffffff",
            button_primary_background_fill="#0284c7",
            button_primary_text_color="#ffffff",
        )
    except (TypeError, AttributeError):
        pass

    with gr.Blocks(
        css=CUSTOM_CSS,
        title="GSDP Semantic Search",
        theme=_theme,
    ) as app:

        with gr.Column(elem_classes="header-section"):
            gr.Markdown(
                "# GSDP Semantic Search\n"
                "Semantic search and Q&A over multilingual educational content "
                "(PDFs, audio, images, and video)."
            )

        with gr.Row(elem_classes="controls-row"):
            media_filter = gr.Dropdown(
                choices=["All", "PDF", "Audio", "Image", "Video"],
                value="All",
                label="Media type",
                scale=1
            )

        with gr.Row():
            with gr.Column(scale=3):
                with gr.Row(elem_classes="lang-section"):
                    lang_radio = gr.Radio(
                        choices=[
                            "\U0001F1EC\U0001F1E7 English",
                            "\U0001F1EA\U0001F1F8 Espa\u00f1ol",
                            "\U0001F1EB\U0001F1F7 Fran\u00e7ais",
                            "\U0001F1EE\U0001F1F9 Italiano",
                            "\U0001F1E7\U0001F1F7 Portugu\u00eas"
                        ],
                        value="\U0001F1EC\U0001F1E7 English",
                        label="Response language",
                        interactive=True
                    )

                answer_output = gr.Markdown(
                    value="*Ask a question to explore the knowledge base…*",
                    label="Answer",
                    elem_classes="chat-area",
                    sanitize_html=False,
                )

                query_input = gr.Textbox(
                    placeholder="e.g., What is the Preventive System methodology?",
                    label="Your question",
                    lines=2,
                    max_lines=4
                )
                with gr.Row():
                    submit_btn = gr.Button(
                        "Search & analyze",
                        variant="primary",
                        elem_classes="primary-btn",
                        scale=2
                    )
                    clear_btn = gr.Button("Clear", scale=1)

            with gr.Column(scale=1, elem_classes="sources-panel"):
                gr.Markdown("### Retrieved sources")
                sources_output = gr.Markdown(
                    value="*Sources will appear here after your query…*",
                    sanitize_html=False,
                )

        with gr.Accordion("Example questions", open=False, elem_classes=["rag-accordion"]):
            gr.Examples(
                examples=[[q] for q in EXAMPLE_QUERIES],
                inputs=query_input,
                label="Click any example to try:"
            )

       

        # Event handlers
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
            fn=lambda: ("", "*Ask a question to explore the knowledge base…*", "*Sources will appear here…*"),
            outputs=[query_input, answer_output, sources_output]
        )

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
