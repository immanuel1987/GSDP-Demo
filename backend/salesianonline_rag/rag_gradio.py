import gradio as gr
from gradio.routes import mount_gradio_app
from .app import chat  # import your pipeline

def mount_rag_gradio(app, path="/rag"):
    # Wrap your chat generator into a Gradio interface
    demo = gr.ChatInterface(
        fn=lambda message, history: list(chat(message, media_filter="All")),
        title="Salesian Online RAG Assistant"
    )
    mount_gradio_app(app, demo, path=path)

