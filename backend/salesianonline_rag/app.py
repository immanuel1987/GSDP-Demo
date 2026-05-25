""" 
Salesian Online - RAG Knowledge Assistant
A professional Databricks App for semantic search and Q&A
over multilingual educational content (PDFs, Audio, Images, Video).

Search Flow:
1. First perform exact keyword matching against ALL indexed columns (Tier 1)
2. Return all directly matched records from the table
3. If no relevant match exists, trigger deep semantic/vector search (Tier 2)
4. Avoid returning unrelated documents during the initial table search
5. Prioritize exact matches over semantic similarity results

Column Mapping (testing.gold.vector_content_index):
- title: document title (unique, searchable)
- abstract: clean document text (unique, primary content field)
- contributor: author/contributor ID (cleaned for matching)
- country: geographic location (searchable)
- inferred_continent: continent (searchable)
- language: document language (searchable, structured query)
- knowledge_area: academic area (searchable)
- work_type: document type (searchable)
- salesian_family_group: family group (searchable)
- file_name: filename (searchable)
- publication_year: year published (structured query)
- content_classification: EXCLUDED from keyword matching (boilerplate taxonomy)
- subject: EXCLUDED from keyword matching (structured resource IDs)
- vector_search_text: embedding source (used for year metadata extraction only)
"""

import os
import sys
import traceback
import re
import requests as http_requests
import gradio as gr
from fastapi import FastAPI

# ============================================================
# CONFIGURATION
# ============================================================
ENDPOINT_NAME = os.environ.get("VECTOR_SEARCH_ENDPOINT", "salesianonline_vs_endpoint")
INDEX_NAME = os.environ.get("VECTOR_SEARCH_INDEX", "testing.gold.vector_content_index")
LLM_ENDPOINT = os.environ.get("LLM_ENDPOINT", "databricks-meta-llama-3-3-70b-instruct")

# Minimum similarity score threshold (0 to 1).
SIMILARITY_THRESHOLD = float(os.environ.get("SIMILARITY_THRESHOLD", "0.45"))

GSDP_HOME_URL = os.environ.get("GSDP_HOME_URL", "https://gsdp-dev.cristoerp.com/")

# All columns to fetch from the vector search index
FETCH_COLUMNS = [
    "file_name", "title", "work_type", "language",
    "content_classification", "vector_search_text",
    "subject", "knowledge_area", "contributor", "url",
    "publication_year", "abstract", "country",
    "inferred_continent", "salesian_family_group"
]


def ensure_https(url):
    if not url:
        return url
    url = url.strip()
    if not url.startswith("https://") and not url.startswith("http://"):
        url = f"https://{url}"
    return url.rstrip("/")


# ============================================================
# AUTHENTICATION
# ============================================================
def get_host():
    host = os.environ.get("DATABRICKS_HOST", "https://adb-7405609771152190.10.azuredatabricks.net/")
    print("Test the host",host)
    return ensure_https(host)


def get_oauth_token():
    host = get_host()
    client_id = os.environ.get("DATABRICKS_CLIENT_ID", "e91a07b8-d63e-4c69-8a18-c06e02c7d72a")
    client_secret = os.environ.get("DATABRICKS_CLIENT_SECRET", "doseb82d028e4092185863a5c4672e09a82c")
    token_url = f"{host}/oidc/v1/token"
    print("Test token url",token_url)
    response = http_requests.post(
        token_url,
        data={"grant_type": "client_credentials", "client_id": client_id,
              "client_secret": client_secret, "scope": "all-apis"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    response.raise_for_status()
    return response.json()["access_token"]


# ============================================================
# LAZY CLIENT INITIALIZATION
# ============================================================
_vsc = None

def get_vsc():
    global _vsc
    if _vsc is None:
        from databricks.vector_search.client import VectorSearchClient
        host = get_host()
        client_id = os.environ.get("DATABRICKS_CLIENT_ID")
        client_secret = os.environ.get("DATABRICKS_CLIENT_SECRET")
        if client_id and client_secret:
            _vsc = VectorSearchClient(
                workspace_url=host,
                service_principal_client_id=client_id,
                service_principal_client_secret=client_secret,
                disable_notice=True
            )
        else:
            _vsc = VectorSearchClient(
                workspace_url=host,
                personal_access_token=get_oauth_token(),
                disable_notice=True
            )
    return _vsc


def get_llm_client():
    from openai import OpenAI
    return OpenAI(api_key=get_oauth_token(), base_url=f"{get_host()}/serving-endpoints")


# ============================================================
# MEDIA TYPE ICONS
# ============================================================
MEDIA_ICONS = {
    "pdf": "\U0001F4C4",
    "audio": "\U0001F3A7",
    "image": "\U0001F5BC\uFE0F",
    "video": "\U0001F3A5",
    "thesis": "\U0001F393",
    "article": "\U0001F4F0",
    "book": "\U0001F4DA",
    "report": "\U0001F4CB",
    "regarding all": "\U0001F4DA"
}

LANGUAGE_FLAGS = {
    "EN": "\U0001F1EC\U0001F1E7",
    "ES": "\U0001F1EA\U0001F1F8",
    "FR": "\U0001F1EB\U0001F1F7",
    "IT": "\U0001F1EE\U0001F1F9",
    "POR": "\U0001F1E7\U0001F1F7",
    "Portuguese": "\U0001F1E7\U0001F1F7",
    "English": "\U0001F1EC\U0001F1E7",
    "Spanish": "\U0001F1EA\U0001F1F8",
    "French": "\U0001F1EB\U0001F1F7",
    "Italian": "\U0001F1EE\U0001F1F9",
    "En": "\U0001F1EC\U0001F1E7",
    "Es": "\U0001F1EA\U0001F1F8",
    "Fr": "\U0001F1EB\U0001F1F7",
    "It": "\U0001F1EE\U0001F1F9",
    "Por": "\U0001F1E7\U0001F1F7",
    "UNKNOWN": "\U0001F310"
}

LANGUAGE_NAMES = {
    "EN": "English",
    "ES": "Spanish",
    "FR": "French",
    "IT": "Italian",
    "POR": "Portuguese",
    "DE": "German"
}

# Expand language abbreviations to full names for keyword matching
# THIS IS THE SINGLE SOURCE OF TRUTH for supported languages.
# Adding a new entry here auto-enables: code detection, keyword expansion, and filtering.
LANGUAGE_EXPANSIONS = {
    "en": "english",
    "es": "spanish español",
    "fr": "french français",
    "it": "italian italiano",
    "por": "portuguese português",
    "de": "german deutsch"
}

# Language query detection map (includes native language names for multilingual queries)
LANGUAGE_QUERY_MAP = {
    "english": "en", "italian": "it", "french": "fr",
    "spanish": "es", "portuguese": "por",
    # Italian names
    "inglese": "en", "italiano": "it", "francese": "fr",
    "spagnolo": "es", "portoghese": "por",
    # French names
    "anglais": "en", "italien": "it", "français": "fr",
    "francais": "fr", "espagnol": "es", "portugais": "por",
    # Spanish names
    "inglés": "en", "ingles": "en", "italiano": "it",
    "francés": "fr", "frances": "fr", "español": "es",
    "espanol": "es", "portugués": "por", "portugues": "por",
    # Portuguese names
    "inglês": "en", "ingles": "en", "italiano": "it",
    "francês": "fr", "frances": "fr", "espanhol": "es",
    "português": "por", "portugues": "por",
    # German names (test language - added dynamically)
    "german": "de", "deutsch": "de", "tedesco": "de",
    "allemand": "de", "alemán": "de", "aleman": "de", "alemão": "de"
}

# Valid language codes - AUTO-DERIVED from LANGUAGE_EXPANSIONS (single source of truth).
# To add a new language: just add its code + expansion to LANGUAGE_EXPANSIONS above.
# Everything else (code detection, keyword expansion) will work automatically.
VALID_LANG_CODES = set(LANGUAGE_EXPANSIONS.keys())

# Context words that signal a language query (multilingual support)
LANG_CONTEXT_WORDS = {"language", "lang", "lingua", "idioma", "langue", "idiome"}

# Stop words to ignore during keyword validation
STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
    "into", "through", "during", "before", "after", "above", "below",
    "between", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "every",
    "both", "few", "more", "most", "other", "some", "such", "no",
    "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "and", "but", "or", "if", "while", "about",
    "what", "which", "who", "whom", "this", "that", "these", "those",
    "am", "it", "its", "i", "me", "my", "we", "our", "you", "your",
    "he", "him", "his", "she", "her", "they", "them", "their",
    "show", "list", "give", "find", "get", "tell", "display",
    "documents", "document", "content", "available", "please",
    "using", "information", "related", "reference", "references",
    "out", "regarding"
}

# Intent words - describe what the user wants or which field to search,
# not the actual content to match against. These are filtered out when
# other meaningful content keywords exist in the query.
INTENT_WORDS = {
    # Temporal qualifiers
    "year", "publication", "date", "published", "period", "time",
    # Field qualifiers (describe metadata fields, not content)
    "author", "writer", "contributor", "name", "written",
    # Query intent
    "methodology", "explain", "describe", "relationship", "overview",
    "summary", "detail", "details", "meaning", "definition"
}


# ============================================================
# COLUMN CLEANING UTILITIES
# ============================================================
def clean_contributor(raw_contributor):
    """Clean structured contributor ID for human-readable matching.
    Example: 'person_giovanni_bosco' → 'giovanni bosco'
    """
    if not raw_contributor:
        return ""
    # Remove common prefixes
    cleaned = raw_contributor.lower()
    cleaned = re.sub(r'^person_', '', cleaned)
    # Replace underscores with spaces
    cleaned = cleaned.replace('_', ' ')
    return cleaned.strip()


def extract_metadata_year(text, field_name):
    """Extract a year value from a metadata field in vector_search_text."""
    if not text:
        return None
    pattern = rf'{field_name}:\s*(\d{{4}})'
    match = re.search(pattern, text)
    if match:
        return int(match.group(1))
    return None


def extract_bibliographical_citation(text):
    """Extract bibliographical citation from vector_search_text, cleaned of publisher location.
    
    The vector_search_text contains embedded metadata including:
    hasBibliographicalCitation: Salesian Historical Institute, Salesian Sources 1: Don Bosco
    and his work. Collected Works, LAS - Kristu Jyoti, Rome - Bangalore, 2017, pages.
    
    Returns only the series/collection name (before ', LAS') to avoid false positives
    from publisher location names like 'Rome' and 'Bangalore'.
    """
    if not text:
        return ""
    pattern = r'hasBibliographicalCitation:\s*(.+?)(?:\n|\r|$)'
    match = re.search(pattern, text)
    if not match:
        return ""
    citation = match.group(1).strip()
    # Truncate at ", LAS" to remove publisher location boilerplate
    # (e.g., "LAS - Kristu Jyoti, Rome - Bangalore, 2017, 1104-1114.")
    las_idx = citation.find(", LAS")
    if las_idx > 0:
        citation = citation[:las_idx]
    return citation


# ============================================================
# QUERY ANALYSIS
# ============================================================
def extract_year_ranges(query):
    """Detect date ranges like '1860-1885' or '1860–1885' (en-dash) in query.
    Returns list of (start_year, end_year) tuples.
    """
    range_pattern = r'(\d{4})\s*[\-–—]\s*(\d{4})'
    ranges = []
    for match in re.finditer(range_pattern, query):
        start_yr = int(match.group(1))
        end_yr = int(match.group(2))
        if start_yr < end_yr:
            ranges.append((start_yr, end_yr))
    return ranges


def extract_keywords(query):
    """Extract meaningful keywords from a query by removing stop words and intent words.
    Date ranges (e.g. '1860-1885') are handled separately, not as individual keywords.
    """
    # Remove date range patterns so individual years aren't extracted
    range_pattern = r'\d{4}\s*[\-–—]\s*\d{4}'
    query_without_ranges = re.sub(range_pattern, ' ', query)

    words = re.findall(r'[a-zA-Z0-9]+', query_without_ranges.lower())
    keywords = [w for w in words if w not in STOP_WORDS and len(w) > 2]

    # Filter out intent/context words when other content keywords exist.
    # Intent words describe the user's goal or which field to search
    # (e.g., "author", "year", "explain"), not the content to match.
    # If ALL keywords are intent words, keep them (user may be searching for that term).
    content_keywords = [w for w in keywords if w not in INTENT_WORDS]
    if content_keywords:
        keywords = content_keywords

    return keywords


def is_language_query(query, keywords):
    """Detect if query is asking for documents in a specific language.
    
    Dynamic detection - works with ANY language code, known or unknown.
    NO hardcoded regex patterns needed.
    
    Detection priority:
    1. Full language names from LANGUAGE_QUERY_MAP (e.g., 'English', 'Francais', 'Italiano')
    2. Known codes from VALID_LANG_CODES (auto-derived from LANGUAGE_EXPANSIONS):
       - Short codes (2 chars): require a context word nearby
       - Longer codes (3+ chars: por): accepted as standalone words
       - Code alone as entire query: accepted
    3. Unknown codes: when a context word (like "language") is present and
       accompanied by a short alphabetic word (2-4 chars), treat as language query.
       This ensures "language ta", "language zh", etc. correctly return 0 docs
       instead of matching "language" as a content keyword.
    
    To add a new language: just add to LANGUAGE_EXPANSIONS (e.g., "de": "german deutsch").
    VALID_LANG_CODES auto-updates, and code detection works immediately.
    """
    query_lower = query.lower()
    query_words = query_lower.split()
    
    # 1. Check full language names (highest priority, unambiguous)
    for lang_name, lang_code in LANGUAGE_QUERY_MAP.items():
        if lang_name in query_lower:
            return lang_code
    
    # 2. Check if any query word is a valid (known) language code
    for word in query_words:
        if word in VALID_LANG_CODES:
            if len(word) >= 3:
                # Longer codes (e.g., "por") are unambiguous - accept directly
                return word
            else:
                # Short codes (en, it, fr, es, de): require a context word
                if LANG_CONTEXT_WORDS.intersection(query_words):
                    return word
                # Or accept if the query is JUST the code alone
                if len(query_words) == 1:
                    return word
    
    # 3. Handle UNKNOWN codes: if a context word is present with a short
    #    alphabetic word that looks like a language code (2-4 chars, all alpha),
    #    treat it as a language query. This prevents "language ta" from matching
    #    "language" as a content keyword and returning false positives.
    if LANG_CONTEXT_WORDS.intersection(query_words):
        for word in query_words:
            if word in LANG_CONTEXT_WORDS:
                continue
            # Accept any short alphabetic word as a potential language code
            if word.isalpha() and 2 <= len(word) <= 4 and word not in LANG_CONTEXT_WORDS:
                return word  # Return the unknown code (will match 0 docs in filter)
    
    return None


def is_publication_year_query(query, keywords):
    """Detect if query is asking about publication year (e.g. '2017', 'year of publication: 2017')."""
    years = [w for w in keywords if w.isdigit() and len(w) == 4 and int(w) >= 1900]
    if years:
        return years
    return None


def is_full_sentence_query(query, keywords):
    """Detect if query is a natural language question (5+ words or contains '?')."""
    if '?' in query:
        return True
    word_count = len(query.split())
    return word_count >= 5 and len(keywords) >= 3


# ============================================================
# TOKEN-BASED MATCHING
# ============================================================
def tokenize(text):
    """Extract alphanumeric tokens from text."""
    return set(re.findall(r'[a-z0-9]+', text.lower()))


def stem_token(token):
    """Lightweight stemming: remove common suffixes."""
    if len(token) <= 4:
        return token
    if token.endswith('ing') and len(token) > 5:
        return token[:-3]
    if token.endswith('tion') and len(token) > 6:
        return token[:-4]
    if token.endswith('ness') and len(token) > 6:
        return token[:-4]
    if token.endswith('ment') and len(token) > 6:
        return token[:-4]
    if token.endswith('es') and len(token) > 4:
        return token[:-2]
    if token.endswith('ed') and len(token) > 4:
        return token[:-2]
    if token.endswith('ly') and len(token) > 4:
        return token[:-2]
    if token.endswith('s') and not token.endswith('ss') and len(token) > 4:
        return token[:-1]
    return token


def token_matches(keyword, tokens):
    """Check if a keyword matches any token using stemming and prefix matching.
    Avoids broad substring false positives (e.g. 'sale' matching 'salesians' only
    if 'sale' is >= 4 chars and is a prefix or stem match).
    """
    keyword_stem = stem_token(keyword)

    for token in tokens:
        # Exact match
        if keyword == token:
            return True
        # Stem match
        if keyword_stem == stem_token(token):
            return True
        # Prefix match (keyword is prefix of token) - only for keywords >= 4 chars
        if len(keyword) >= 4 and token.startswith(keyword):
            return True
        # Token is prefix of keyword
        if len(token) >= 4 and keyword.startswith(token):
            return True

    return False


# ============================================================
# DOCUMENT BUILDING AND MATCHING
# ============================================================
def build_document(row):
    """Build a document dict from a vector search result row.
    
    Uses ALL indexed columns:
    Row indices (based on FETCH_COLUMNS order):
      0: file_name, 1: title, 2: work_type, 3: language,
      4: content_classification, 5: vector_search_text,
      6: subject, 7: knowledge_area, 8: contributor, 9: url,
      10: publication_year, 11: abstract, 12: country,
      13: inferred_continent, 14: salesian_family_group
    Last element: similarity score
    """
    raw_vector_text = row[5] or ""

    # Extract metadata years from vector_search_text (has embedded year fields)
    ref_start_year = extract_metadata_year(raw_vector_text, 'hasReferenceYearOfStartYear')
    ref_end_year = extract_metadata_year(raw_vector_text, 'hasReferenceYearOfEndYear')

    return {
        "file_name": row[0] or "",
        "title": row[1] or "",
        "work_type": row[2] or "",
        "language": row[3] or "",
        "content_classification": row[4] or "",
        "vector_search_text": raw_vector_text,
        "subject": row[6] or "",
        "knowledge_area": row[7] or "",
        "contributor": row[8] or "",
        "url": row[9] or "",
        "publication_year": str(int(row[10])) if row[10] else "",
        "abstract": row[11] or "",
        "country": row[12] or "",
        "inferred_continent": row[13] or "",
        "salesian_family_group": row[14] or "",
        "bibliographical_citation": extract_bibliographical_citation(raw_vector_text),
        "ref_start_year": ref_start_year,
        "ref_end_year": ref_end_year,
        "score": row[-1] if row else 0
    }


def build_searchable_text(doc):
    """Build searchable text from ALL relevant indexed columns.
    
    Includes:
    - title: document title
    - abstract: clean document content (primary content field)
    - contributor: cleaned from structured ID (e.g. 'person_giovanni_bosco' → 'giovanni bosco')
    - country: geographic location
    - inferred_continent: continent
    - knowledge_area: academic area
    - work_type: document type
    - language: with expansion to full language names
    - salesian_family_group: family group
    - file_name: may contain meaningful keywords
    
    Also includes:
    - bibliographical_citation: extracted from vector_search_text (contains collection/series name)
    
    EXCLUDES:
    - content_classification: boilerplate taxonomy (same for all docs, contains misleading names)
    - subject: structured resource IDs (e.g. 'resource_11663.0'), not searchable text
    - vector_search_text: raw embedding source with embedded metadata (use 'abstract' instead)
    - url: not searchable content
    """
    lang_expanded = LANGUAGE_EXPANSIONS.get(doc.get("language", "").lower().strip(), "")
    cleaned_contributor = clean_contributor(doc.get("contributor", ""))

    searchable_parts = [
        doc.get("title", ""),
        doc.get("abstract", ""),             # Clean content from dedicated column
        cleaned_contributor,                  # 'giovanni bosco' (cleaned from 'person_giovanni_bosco')
        doc.get("country", ""),              # 'Italy'
        doc.get("inferred_continent", ""),   # 'EuropeMiddleEast'
        doc.get("knowledge_area", ""),       # 'Salesian Formation'
        doc.get("work_type", ""),            # 'Regarding All'
        doc.get("language", ""),             # 'En'
        lang_expanded,                       # 'english'
        doc.get("salesian_family_group", ""),# 'Relevant To All Carismatic Family'
        doc.get("file_name", ""),            # PDF filename
        doc.get("bibliographical_citation", ""),  # 'Salesian Sources 1: Don Bosco...' (collection/series)
    ]

    return " ".join(searchable_parts).lower()


def document_matches_exact(doc, keywords, year_ranges, query):
    """Tier 1: Exact keyword matching against ALL indexed columns.
    
    Matches keywords against all relevant columns in the table:
    title, abstract, contributor (cleaned), country, inferred_continent,
    knowledge_area, work_type, language, salesian_family_group, file_name.
    
    EXCLUDES: content_classification (boilerplate taxonomy), subject (resource IDs).
    
    For year ranges: checks if document's reference years overlap the range.
    For publication years: matches ONLY against publication_year field.
    For language queries: matches against document.language field.
    """
    # --- Language query handling ---
    lang_code = is_language_query(query, keywords)
    if lang_code:
        doc_lang = doc.get("language", "").lower().strip()
        if doc_lang != lang_code:
            return False
        # If query ONLY contains a language name (no other content keywords),
        # return all docs in that language
        # Remove language-related words from keywords to get content keywords
        lang_words_to_remove = set()
        for lang_name in LANGUAGE_QUERY_MAP:
            lang_words_to_remove.update(lang_name.split())
        lang_words_to_remove.update(["language", "lang", "lingua", "idioma", "langue"])
        content_keywords = [k for k in keywords if k not in lang_words_to_remove]
        if not content_keywords:
            return True  # Pure language query → return all docs in that language
        # Combined query: language + content → apply content keyword matching below
        keywords = content_keywords

    # --- Year range handling ---
    if year_ranges:
        for (start_yr, end_yr) in year_ranges:
            range_matched = False

            # Check reference year overlap
            doc_start = doc.get("ref_start_year")
            doc_end = doc.get("ref_end_year")
            if doc_start and doc_end:
                if doc_start <= end_yr and doc_end >= start_yr:
                    range_matched = True
            elif doc_start:
                if start_yr <= doc_start <= end_yr:
                    range_matched = True
            elif doc_end:
                if start_yr <= doc_end <= end_yr:
                    range_matched = True

            # Also check publication_year
            pub_year = doc.get("publication_year", "")
            if pub_year and pub_year.isdigit():
                yr = int(pub_year)
                if start_yr <= yr <= end_yr:
                    range_matched = True

            # Check for year mentions in abstract content
            if not range_matched:
                abstract_lower = doc.get("abstract", "").lower()
                for yr in range(start_yr, end_yr + 1):
                    if str(yr) in abstract_lower:
                        range_matched = True
                        break

            if not range_matched:
                return False

    # --- Publication year query handling ---
    pub_year_keywords = is_publication_year_query(query, keywords)
    non_year_keywords = [k for k in keywords if not (k.isdigit() and len(k) == 4)]

    if pub_year_keywords:
        # Year keywords match ONLY against publication_year field
        doc_pub_year = doc.get("publication_year", "")
        for yr_kw in pub_year_keywords:
            if yr_kw != doc_pub_year:
                return False
        keywords_to_check = non_year_keywords
    else:
        keywords_to_check = keywords

    # --- Keyword matching against ALL indexed columns ---
    searchable_text = build_searchable_text(doc)
    tokens = tokenize(searchable_text)

    # --- Full sentence query: relaxed matching ---
    if is_full_sentence_query(query, keywords_to_check):
        if not keywords_to_check:
            return True
        match_count = sum(1 for kw in keywords_to_check if token_matches(kw, tokens))
        # Require at least 50% of keywords, minimum 2
        required = max(2, len(keywords_to_check) // 2)
        return match_count >= required

    # --- Short/exact keyword queries: strict ALL-match ---
    for keyword in keywords_to_check:
        if len(keyword) <= 3:
            if keyword not in tokens:
                return False
        else:
            if not token_matches(keyword, tokens):
                return False

    return True


def document_matches_semantic(doc, keywords, year_ranges, query):
    """Tier 2: Relaxed semantic matching - only basic relevance check.
    Used as fallback when Tier 1 (exact) returns nothing.
    Returns True for any document above the similarity threshold with at least
    partial keyword overlap across ALL columns.
    """
    if not keywords and not year_ranges:
        return True

    # For year ranges, still require range match
    if year_ranges:
        for (start_yr, end_yr) in year_ranges:
            range_matched = False
            doc_start = doc.get("ref_start_year")
            doc_end = doc.get("ref_end_year")
            if doc_start and doc_end:
                if doc_start <= end_yr and doc_end >= start_yr:
                    range_matched = True
            pub_year = doc.get("publication_year", "")
            if pub_year and pub_year.isdigit():
                if start_yr <= int(pub_year) <= end_yr:
                    range_matched = True
            if not range_matched:
                abstract_lower = doc.get("abstract", "").lower()
                for yr in range(start_yr, end_yr + 1):
                    if str(yr) in abstract_lower:
                        range_matched = True
                        break
            if not range_matched:
                return False

    # For semantic tier, require at least ONE keyword match across all columns
    if keywords:
        searchable_text = build_searchable_text(doc)
        tokens = tokenize(searchable_text)
        match_count = sum(1 for kw in keywords if token_matches(kw, tokens))
        return match_count >= 1

    return True


# ============================================================
# RAG PIPELINE
# ============================================================
_last_query = ""
_last_docs = []


def retrieve_context(query, media_filter="All"):
    """Two-tier retrieval pipeline matching against ALL indexed columns:
    
    Tier 1 (Exact Match): Check all indexed records for direct keyword matches
           across ALL table columns. Returns all exactly matched documents.
    
    Tier 2 (Semantic Fallback): If no exact matches found, return semantically similar
           documents that pass basic relevance checks.
    
    Column matching coverage:
    - title, abstract, contributor (cleaned), country, inferred_continent
    - knowledge_area, work_type, language, salesian_family_group, file_name
    
    This ensures no documents are missed when a keyword is present in ANY column.
    """
    try:
        vsc = get_vsc()
        index = vsc.get_index(endpoint_name=ENDPOINT_NAME, index_name=INDEX_NAME)

        search_kwargs = {
            "query_text": query,
            "columns": FETCH_COLUMNS,
            "num_results": 1000
        }

        # Apply media type filter from dropdown
        if media_filter and media_filter != "All":
            search_kwargs["filters"] = {"work_type": media_filter.lower()}

        results = index.similarity_search(**search_kwargs)

        # Extract keywords and year ranges from query
        keywords = extract_keywords(query)
        year_ranges = extract_year_ranges(query)

        # For language and publication year queries, use a lower threshold since
        # the structured field (language/publication_year) is the real discriminator,
        # NOT vector similarity. A query like "2017" may score low on semantic
        # similarity but the publication_year field match is what matters.
        lang_code = is_language_query(query, keywords)
        pub_year_keywords = is_publication_year_query(query, keywords)
        if lang_code or pub_year_keywords or year_ranges:
            effective_threshold = 0.01
        else:
            effective_threshold = SIMILARITY_THRESHOLD

        # Build all candidate documents (above similarity threshold, with valid URL)
        all_candidates = []
        for row in results.get("result", {}).get("data_array", []):
            score = row[-1] if row else 0
            if score < effective_threshold:
                continue
            url = row[9] or ""
            if not url.strip():
                continue
            doc = build_document(row)
            all_candidates.append(doc)

        # --- Tier 1: Exact keyword matching ---
        # Check for exact title match first (highest priority)
        normalized_query = re.sub(r'[^a-z0-9\s]', '', query.lower()).strip()
        for doc in all_candidates:
            normalized_title = re.sub(r'[^a-z0-9\s]', '', doc.get("title", "").lower()).strip()
            if normalized_title and normalized_title == normalized_query:
                return [doc]

        # Exact keyword match against ALL indexed columns
        exact_matches = []
        for doc in all_candidates:
            if document_matches_exact(doc, keywords, year_ranges, query):
                exact_matches.append(doc)

        if exact_matches:
            exact_matches.sort(key=lambda d: d.get("score", 0), reverse=True)
            return exact_matches

        # For language queries, Tier 1 result is definitive - do NOT fall through
        # to Tier 2 (which would match "french"/"italian" as content keywords)
        if lang_code:
            return []

        # --- Tier 2: Semantic similarity fallback ---
        # Only triggered if Tier 1 returns nothing
        semantic_matches = []
        for doc in all_candidates:
            if document_matches_semantic(doc, keywords, year_ranges, query):
                semantic_matches.append(doc)

        if semantic_matches:
            semantic_matches.sort(key=lambda d: d.get("score", 0), reverse=True)
            return semantic_matches

        # No matches at all
        return []

    except Exception as e:
        print(f"[ERROR] Retrieval failed: {e}", file=sys.stderr)
        traceback.print_exc()
        return [{"error": str(e)}]


def generate_answer(query, context_docs, language_pref="English"):
    """Generate answer using LLM with retrieved context.
    
    The system prompt explicitly tells the LLM that documents were PRE-FILTERED
    by the retrieval system, so the LLM should trust the results and not
    second-guess the filtering logic.
    """
    context_parts = []
    for i, doc in enumerate(context_docs, 1):
        if "error" in doc:
            continue
        icon = MEDIA_ICONS.get(doc.get("work_type", "").lower(), "")
        title_display = doc.get("title") or doc.get("file_name") or "Unknown"
        pub_year = doc.get("publication_year") or "N/A"
        contributor = clean_contributor(doc.get("contributor", "")).title() or "N/A"
        context_parts.append(
            f"--- Source {i}: {icon} {title_display} ---\n"
            f"Type: {doc.get('work_type') or 'N/A'} | "
            f"Language: {doc.get('language') or 'N/A'} | "
            f"Publication Year: {pub_year} | "
            f"Contributor: {contributor} | "
            f"Country: {doc.get('country') or 'N/A'} | "
            f"Knowledge Area: {doc.get('knowledge_area') or 'N/A'}\n"
            f"Abstract: {doc.get('abstract', '')}")
    context_text = "\n\n".join(context_parts)

    # Determine query type for targeted instructions
    query_lower = query.lower().strip()
    is_year_query = bool(re.match(r'^\d{4}$', query_lower))
    is_listing_query = any(w in query_lower for w in ["list", "show", "display", "give me", "all"])

    system_prompt = f"""You are a knowledgeable assistant for the Salesian Online educational platform.
You answer questions about Salesian educational content based ONLY on the retrieved documents provided below.

IMPORTANT CONTEXT:
- The documents below have been PRE-FILTERED by a retrieval system that already matched them to the user's query.
- ALL {len(context_docs)} documents shown are RELEVANT to the query. Do NOT say they are unrelated.
- If the user searched a year (e.g., "2017"), all documents shown have that publication year — acknowledge this.
- If the user searched a keyword, all documents shown contain that keyword in their content or metadata.
- NEVER contradict the retrieval system by saying documents "don't match" or are "not related."

RESPONSE FORMAT:
1. Answer in {language_pref}.
2. Start with a brief summary statement answering the query directly (1-2 sentences).
3. Then provide details:
   - For listing/filter queries (years, languages, topics): List ALL documents in a numbered list showing title, type, and year.
   - For knowledge questions: Provide a structured answer with key points, citing document titles.
   - For single-keyword queries: Briefly explain what the documents cover, then list the top results.
4. Use bullet points or numbered lists for readability.
5. Always mention document titles when referencing sources.
6. Keep responses concise but complete — aim for quality over length.
7. If listing many documents (>10), group them or show first 10 with a count summary.
"""

    # Tailor the user message based on query type
    if is_year_query:
        user_message = f"""The user searched for: "{query}"

The retrieval system found {len(context_docs)} documents published in {query}.
List these documents with their titles, types, and a brief description of their content.

**Retrieved Documents (all published in {query}):**
{context_text}"""
    elif is_listing_query:
        user_message = f"""The user asked: "{query}"

The retrieval system found {len(context_docs)} matching documents.
List ALL matching documents with their titles, types, publication years, and languages.

**Retrieved Documents:**
{context_text}"""
    else:
        user_message = f"""Based on the following {len(context_docs)} retrieved documents, answer this question:

**Question:** {query}

**Retrieved Documents:**
{context_text}

Provide a comprehensive answer based on the document content."""

    try:
        client = get_llm_client()
        response = client.chat.completions.create(
            model=LLM_ENDPOINT,
            messages=[{"role": "system", "content": system_prompt},
                     {"role": "user", "content": user_message}],
            max_tokens=2048, temperature=0.2
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[ERROR] LLM failed: {e}", file=sys.stderr)
        traceback.print_exc()
        return f"Error generating response: {str(e)}"




def format_sources(docs):
    """Format source documents with clear visual hierarchy, no icons."""
    if not docs or (isinstance(docs[0], dict) and "error" in docs[0]):
        return "No sources retrieved."
    sources_md = f"**{len(docs)} Matched Document(s):**\n\n---\n\n"
    for i, doc in enumerate(docs, 1):
        work_type = doc.get("work_type") or ""
        language = doc.get("language") or ""
        title_display = doc.get("title") or doc.get("file_name") or "Unknown"
        score = doc.get("score", 0)

        # Title line
        sources_md += f"**{i}. {title_display}**\n\n"

        # Metadata block
        sources_md += f"\u2022 Relevance: `{score:.0%}`\n\n"
        sources_md += f"\u2022 Language: {language or 'N/A'}\n\n"
        sources_md += f"\u2022 Type: {work_type or 'N/A'}\n\n"
        if doc.get("knowledge_area"):
            sources_md += f"\u2022 Area: {doc['knowledge_area']}\n\n"
        if doc.get("contributor"):
            sources_md += f"\u2022 Author: {clean_contributor(doc['contributor']).title()}\n\n"
        if doc.get("country"):
            sources_md += f"\u2022 Country: {doc['country']}\n\n"

        # View Document link
        sources_md += f"[View Document]({doc['url']})\n\n"

        # Separator between documents
        if i < len(docs):
            sources_md += "---\n\n"

    return sources_md

def chat(message, media_filter):
    """Main RAG pipeline: two-tier retrieval + LLM generation.
    
    Flow:
    1. First perform exact keyword matching against ALL table columns
    2. Return all directly matched documents
    3. If no exact match, trigger deep semantic search
    4. Generate LLM answer from matched context
    """
    global _last_query, _last_docs
    if not message or not message.strip():
        return "", ""
    _last_query = message
    docs = retrieve_context(message, media_filter=media_filter)
    _last_docs = docs
    if docs and isinstance(docs[0], dict) and "error" in docs[0]:
        return f"**Retrieval Error:** {docs[0]['error']}", "No sources available."

    # If no documents pass either tier
    if not docs:
        return (
            "**\u274C No relevant documents found.**\n\n"
            "The search term does not match any content in the knowledge base. "
            "Please try a different query or check for typos."
        ), ""

    answer = generate_answer(message, docs, language_pref="English")
    sources = format_sources(docs)
    return answer, sources


def switch_language(lang_choice):
    """Re-generate the answer in the selected language."""
    global _last_query, _last_docs
    if not _last_query or not _last_docs:
        return "*Ask a question first, then switch languages.*"
    if _last_docs and isinstance(_last_docs[0], dict) and "error" in _last_docs[0]:
        return "No content available to translate."
    lang_map = {
        "\U0001F1EC\U0001F1E7 English": "EN",
        "\U0001F1EA\U0001F1F8 Espa\u00f1ol": "ES",
        "\U0001F1EB\U0001F1F7 Fran\u00e7ais": "FR",
        "\U0001F1EE\U0001F1F9 Italiano": "IT",
        "\U0001F1E7\U0001F1F7 Portugu\u00eas": "POR"
    }
    code = lang_map.get(lang_choice, "EN")
    language_name = LANGUAGE_NAMES.get(code, "English")
    return generate_answer(_last_query, _last_docs, language_pref=language_name)


# ============================================================
# GRADIO UI — GSDP Semantic Search (reference design)
# ============================================================
CUSTOM_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800&display=swap');

/* Hide Gradio default footer: Use via API · Built with Gradio · Settings */
.gradio-container .wrap > footer,
.gradio-container footer:not(.gsdp-footer) {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
}

/* Single page scroll — no nested scroll areas */
html, body {
    overflow-x: hidden !important;
    overflow-y: auto !important;
    height: auto !important;
    margin: 0 !important;
}

/* Full viewport width */
.gradio-container,
.gradio-container .main,
.gradio-container .wrap,
.gradio-container .contain,
.gradio-container .column,
.gradio-container .row,
.gradio-container .block,
.gradio-container .form {
    max-width: 100% !important;
    width: 100% !important;
    box-sizing: border-box !important;
    overflow: visible !important;
    overflow-y: visible !important;
    max-height: none !important;
    height: auto !important;
}

.gradio-container {
    --blue-800: #082f4d;
    --blue-600: #004a99;
    --blue-500: #1f6eb8;
    --blue-100: #daeaf8;
    --blue-50: #eef4fc;
    --surface: #ffffff;
    --border: #d0dff0;
    --border-2: #bccfe8;
    --ink: #0f2744;
    --ink-muted: #4a6b8c;
    --radius-sm: 10px;
    --radius-md: 14px;
    --radius-lg: 20px;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0.75rem clamp(1rem, 2.5vw, 2rem) 2.5rem !important;
    font-family: "Source Sans 3", "Inter", ui-sans-serif, system-ui, sans-serif !important;
    color: var(--ink) !important;
    background:
        radial-gradient(ellipse 130% 60% at 50% -10%, rgba(31, 110, 184, 0.13) 0%, transparent 60%),
        radial-gradient(ellipse 80% 40% at 95% 10%, rgba(0, 74, 153, 0.07) 0%, transparent 50%),
        linear-gradient(170deg, #e8f2fc 0%, #eef4fc 40%, #f3f7fd 100%) !important;
}

/* Section cards span full width */
.header-section,
.panel,
.content-row {
    width: 100% !important;
    max-width: 100% !important;
}

/* Hero header */
.header-section {
    position: relative !important;
    overflow: hidden !important;
    background: linear-gradient(118deg, #061526 0%, #0a2d54 30%, #093368 55%, #0d4a8f 80%, #004a99 100%) !important;
    padding: 1.4rem clamp(1rem, 3vw, 2rem) 1.3rem !important;
    border-radius: var(--radius-lg) !important;
    margin-bottom: 1.25rem !important;
    box-shadow: 0 6px 24px -4px rgba(0, 74, 153, 0.3) !important;
    border: none !important;
}
.header-section::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
    background-size: 22px 22px;
    pointer-events: none;
}
.header-section .prose, .header-section .md { position: relative; z-index: 1; }
.hero-home-link {
    display: inline-flex !important;
    align-items: center;
    font-weight: 600 !important;
    font-size: 0.82rem !important;
    color: rgba(220, 238, 255, 0.95) !important;
    text-decoration: none !important;
    padding: 0.3rem 0.85rem !important;
    border-radius: 99px !important;
    border: 1.5px solid rgba(255, 255, 255, 0.3) !important;
    background: rgba(255, 255, 255, 0.12) !important;
}
.hero-home-link:hover { background: rgba(255, 255, 255, 0.22) !important; color: #fff !important; }
.hero-title {
    color: #fff !important;
    font-size: 1.55rem !important;
    font-weight: 800 !important;
    text-align: center !important;
    margin: 0.5rem 0 0.35rem !important;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
}
.hero-desc {
    color: rgba(210, 230, 255, 0.88) !important;
    font-size: 0.9rem !important;
    text-align: center !important;
    max-width: 46rem;
    margin: 0 auto !important;
    line-height: 1.55 !important;
}
.header-badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.35rem;
    margin-top: 0.7rem;
}
.hbadge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.18rem 0.55rem;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(220, 238, 255, 0.92);
    font-size: 0.72rem;
    font-weight: 600;
}

/* Dark navy panels */
.panel {
    position: relative !important;
    overflow: hidden !important;
    background: linear-gradient(165deg, #071525 0%, #0f2744 48%, #123456 100%) !important;
    border: 1px solid rgba(120, 170, 220, 0.22) !important;
    border-radius: var(--radius-lg) !important;
    padding: 1.15rem 1.35rem 1.25rem !important;
    margin-bottom: 1rem !important;
    box-shadow: 0 10px 32px -6px rgba(5, 26, 48, 0.35) !important;
}
.panel::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 20px 20px;
    pointer-events: none;
}
.panel > .gap, .panel .block { position: relative; z-index: 1; }

.pill-label, .section-chip {
    display: inline-flex !important;
    align-items: center;
    margin-bottom: 0.55rem !important;
    padding: 0.28rem 0.75rem !important;
    border-radius: 99px !important;
    background: linear-gradient(135deg, #2a84d4 0%, #1f6eb8 45%, #004a99 100%) !important;
    color: #fff !important;
    font-size: 0.7rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.07em !important;
    text-transform: uppercase !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    box-shadow: 0 2px 8px rgba(0, 74, 153, 0.35) !important;
}
.section-chip { text-transform: uppercase !important; }

/* Query input */
.search-card .block,
.search-card .form,
.search-card textarea,
.search-card input[type="text"] {
    width: 100% !important;
    max-width: 100% !important;
}
.search-card textarea, .search-card input[type="text"] {
    font-size: 1rem !important;
    color: var(--ink) !important;
    background: #fff !important;
    border: 1.5px solid var(--border-2) !important;
    border-radius: var(--radius-md) !important;
    box-shadow: 0 2px 10px rgba(8, 28, 56, 0.08) !important;
    min-height: 3.25rem !important;
}
.search-card textarea:focus {
    border-color: var(--blue-600) !important;
    box-shadow: 0 0 0 3px rgba(0, 74, 153, 0.14) !important;
}

.search-actions { gap: 0.65rem !important; margin-top: 0.85rem !important; }
.search-actions .btn-primary button {
    flex: 3 !important;
    width: 100% !important;
    font-weight: 700 !important;
    color: #fff !important;
    border: 1px solid rgba(0, 58, 122, 0.6) !important;
    background: linear-gradient(160deg, #2178c4 0%, #004a99 60%, #003a7a 100%) !important;
    border-radius: var(--radius-sm) !important;
    padding: 0.65rem 1.1rem !important;
    box-shadow: 0 4px 14px rgba(0, 74, 153, 0.3) !important;
}
.search-actions .btn-primary button:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 74, 153, 0.38) !important;
}
.search-actions .btn-secondary button {
    flex: 1 !important;
    width: 100% !important;
    font-weight: 600 !important;
    color: var(--blue-800) !important;
    background: #fff !important;
    border: 1.5px solid var(--border-2) !important;
    border-radius: var(--radius-sm) !important;
    padding: 0.65rem 1.1rem !important;
}
.search-actions .btn-secondary button:hover {
    background: var(--blue-50) !important;
    border-color: var(--blue-500) !important;
}

/* Filters row */
.toolbar-row { gap: 1.25rem 2rem !important; align-items: flex-end !important; }
.field-media { min-width: 200px; }
.toolbar-row select, .toolbar-row .gr-dropdown {
    max-width: 100%;
    width: 100% !important;
    background: #fff !important;
    border: 1.5px solid var(--border-2) !important;
    border-radius: var(--radius-md) !important;
    color: var(--ink) !important;
}

/* Language pills — visible on dark toolbar (Gradio styles label, not span) */
.toolbar-row .lang-radio.block,
.toolbar-row .lang-radio fieldset {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
}
.toolbar-row .lang-radio .wrap {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 0.45rem !important;
    background: transparent !important;
    padding: 0 !important;
}
.toolbar-row .lang-radio label {
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.35rem !important;
    margin: 0 !important;
    padding: 0.4rem 0.85rem !important;
    border-radius: 99px !important;
    font-size: 0.82rem !important;
    font-weight: 600 !important;
    line-height: 1.2 !important;
    color: var(--ink) !important;
    background: #fff !important;
    border: 1.5px solid var(--border-2) !important;
    box-shadow: 0 1px 4px rgba(8, 28, 56, 0.08) !important;
    cursor: pointer !important;
}
.toolbar-row .lang-radio label span {
    color: inherit !important;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
}
.toolbar-row .lang-radio label:hover {
    background: var(--blue-50) !important;
    border-color: var(--blue-500) !important;
    color: var(--blue-800) !important;
}
.toolbar-row .lang-radio label.selected,
.toolbar-row .lang-radio label:has(input:checked) {
    color: #fff !important;
    background: linear-gradient(135deg, #2a84d4 0%, #1f6eb8 45%, #004a99 100%) !important;
    border-color: rgba(255, 255, 255, 0.35) !important;
    box-shadow: 0 2px 10px rgba(0, 74, 153, 0.4) !important;
}
.toolbar-row .lang-radio label.selected span,
.toolbar-row .lang-radio label:has(input:checked) span {
    color: #fff !important;
}
.toolbar-row .lang-radio input {
    accent-color: var(--blue-600) !important;
    flex-shrink: 0 !important;
}
.toolbar-row .lang-radio .sr-only { display: none !important; }

/* Results — equal-height cards, each with its own scroll */
.results-area {
    width: 100% !important;
    margin-top: 0.25rem !important;
    overflow: visible !important;
}
.content-row {
    gap: 1rem !important;
    align-items: stretch !important;
    flex-wrap: nowrap !important;
    width: 100% !important;
}
.answer-column,
.sources-column {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 0% !important;
    min-width: 0 !important;
    height: auto !important;
    overflow: visible !important;
}
.answer-column { flex: 3 1 0% !important; }
.sources-column { flex: 1 1 0% !important; min-width: 260px !important; }
.content-row .column > .gap,
.content-row .column > .form {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 auto !important;
    height: 100% !important;
    overflow: visible !important;
}
.content-row .block:not(.answer-panel-card):not(.sources-panel-card) {
    overflow: visible !important;
    max-height: none !important;
}
.content-row .answer-panel-card.block,
.content-row .sources-panel-card.block {
    flex: 1 1 auto !important;
    align-self: stretch !important;
    width: 100% !important;
    background: var(--surface) !important;
    border: 1.5px solid var(--border) !important;
    border-radius: var(--radius-md) !important;
    box-shadow: 0 4px 16px -2px rgba(8, 28, 56, 0.1) !important;
    min-height: 220px !important;
    height: min(65vh, 680px) !important;
    max-height: min(65vh, 680px) !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    padding: 1.25rem 1.35rem !important;
    margin: 0 !important;
    scroll-behavior: smooth;
}
.content-row .answer-panel-card.block::-webkit-scrollbar,
.content-row .sources-panel-card.block::-webkit-scrollbar {
    width: 8px;
}
.content-row .answer-panel-card.block::-webkit-scrollbar-thumb,
.content-row .sources-panel-card.block::-webkit-scrollbar-thumb {
    background: var(--border-2);
    border-radius: 99px;
}
.content-row .answer-panel-card.block::-webkit-scrollbar-thumb:hover,
.content-row .sources-panel-card.block::-webkit-scrollbar-thumb:hover {
    background: var(--blue-500);
}
.content-row .sources-panel-card.block {
    padding: 1.25rem 1.1rem 1.25rem 1.25rem !important;
}
.results-chip-md.block {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    min-height: 0 !important;
    padding: 0 !important;
    margin: 0 0 0.55rem 0 !important;
    overflow: visible !important;
    flex: 0 0 auto !important;
}
.content-row .answer-panel-card .prose,
.content-row .sources-panel-card .prose {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
    font-size: 1rem !important;
    line-height: 1.7 !important;
    color: var(--ink) !important;
}
.answer-panel-card .prose p:first-child em,
.sources-panel-card .prose p:first-child em {
    color: var(--ink-muted) !important;
    font-style: normal !important;
}
.answer-panel-card a, .sources-panel-card a {
    color: var(--blue-600) !important;
    font-weight: 600 !important;
}

.gsdp-footer {
    text-align: center;
    color: var(--ink-muted);
    padding: 1.2rem 1rem 0.5rem;
    font-size: 0.79rem;
    border-top: 1px solid var(--border);
    margin-top: 1rem;
}
.gsdp-footer-logo {
    font-weight: 700;
    color: var(--blue-600);
    margin-bottom: 0.35rem;
    font-size: 0.88rem;
}
.gsdp-footer-sub {
    font-size: 0.79rem;
    line-height: 1.45;
}

/* Loading overlay — shown automatically by Gradio while processing */
@keyframes gsdp-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
}
@keyframes gsdp-spin {
    to { transform: rotate(360deg); }
}
.answer-panel-card.generating,
.sources-panel-card.generating {
    position: relative !important;
}
.answer-panel-card.generating::after,
.sources-panel-card.generating::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 100;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(2px);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
}
.answer-panel-card.generating::before,
.sources-panel-card.generating::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    width: 36px;
    height: 36px;
    border: 3.5px solid var(--border-2);
    border-top-color: var(--blue-600);
    border-radius: 50%;
    animation: gsdp-spin 0.7s linear infinite;
}
/* Hide Gradio's default progress bar */
.answer-panel-card .progress-bar,
.sources-panel-card .progress-bar,
.answer-panel-card .meta-text,
.sources-panel-card .meta-text {
    display: none !important;
}

/* Loading overlay — shown automatically by Gradio while processing */
@keyframes gsdp-spin {
    to { transform: rotate(360deg); }
}
.answer-panel-card.generating,
.sources-panel-card.generating {
    position: relative !important;
}
.answer-panel-card.generating::after,
.sources-panel-card.generating::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 100;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(2px);
    border-radius: var(--radius-md);
}
.answer-panel-card.generating::before,
.sources-panel-card.generating::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    width: 36px;
    height: 36px;
    border: 3.5px solid var(--border-2);
    border-top-color: var(--blue-600);
    border-radius: 50%;
    animation: gsdp-spin 0.7s linear infinite;
}
.answer-panel-card .progress-bar,
.sources-panel-card .progress-bar,
.answer-panel-card .meta-text,
.sources-panel-card .meta-text {
    display: none !important;
}


/* Full-page loading overlay */
.fullpage-loader {
    position: fixed !important;
    inset: 0 !important;
    z-index: 99999 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(8, 47, 77, 0.82) !important;
    backdrop-filter: blur(6px) !important;
    -webkit-backdrop-filter: blur(6px) !important;
}
.fullpage-loader .loader-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
}
.fullpage-loader .loader-spinner {
    width: 56px;
    height: 56px;
    border: 4.5px solid rgba(255, 255, 255, 0.2);
    border-top-color: #4da6ff;
    border-radius: 50%;
    animation: gsdp-fullpage-spin 0.8s linear infinite;
}
.fullpage-loader .loader-text {
    color: #fff;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-align: center;
}
.fullpage-loader .loader-subtext {
    color: rgba(210, 230, 255, 0.75);
    font-size: 0.88rem;
    font-weight: 400;
    margin-top: -0.8rem;
    text-align: center;
}
@keyframes gsdp-fullpage-spin {
    to { transform: rotate(360deg); }
}
/* Ensure the overlay HTML block has no padding/margin from Gradio */
.fullpage-loader-wrapper {
    position: fixed !important;
    inset: 0 !important;
    z-index: 99999 !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    min-height: 0 !important;
    overflow: visible !important;
}

@media (max-width: 900px) {
    .content-row { flex-direction: column !important; }
    .toolbar-row { flex-direction: column !important; align-items: stretch !important; }
}
"""

_LANG_CHOICES = [
    "\U0001F1EC\U0001F1E7 English",
    "\U0001F1EA\U0001F1F8 Espa\u00f1ol",
    "\U0001F1EB\U0001F1F7 Fran\u00e7ais",
    "\U0001F1EE\U0001F1F9 Italiano",
    "\U0001F1E7\U0001F1F7 Portugu\u00eas",
]

_ANSWER_PLACEHOLDER = (
    "*Ask a question above to explore the knowledge base...*"
)
_SOURCES_PLACEHOLDER = (
    "*Sources will appear here after your query...*"
)


def create_app():
    """Build the Gradio application (GSDP Semantic Search reference UI)."""
    home_url = GSDP_HOME_URL.rstrip("/") or "/"

    with gr.Blocks(
        css=CUSTOM_CSS,
        fill_width=True,
        title="GSDP Semantic Search",
        theme=gr.themes.Base(
            primary_hue="blue",
            secondary_hue="blue",
            neutral_hue="slate",
            font=[gr.themes.GoogleFont("Source Sans 3"), "sans-serif"],
        ),
    ) as app:

        with gr.Column(elem_classes="header-section"):
            gr.Markdown(
                f'<div class="hero-home-row">'
                f'<a href="{home_url}" class="hero-home-link" target="_top">'
                f"&#8592; Home</a></div>",
                elem_classes="hero-home-md",
            )
            gr.Markdown(
                '<h1 class="hero-title">Global Salesian Digital Platform '
                "Semantic Search</h1>"
                '<p class="hero-desc">AI-powered search and Q&amp;A over the '
                "Salesian multilingual knowledge base &mdash; PDFs, audio "
                "recordings, images, and video content across five languages."
                "</p>"
                '<div class="header-badges">'
                '<span class="hbadge">&#128196; PDF Documents</span>'
                '<span class="hbadge">&#127911; Audio</span>'
                '<span class="hbadge">&#128444;&#65039; Images</span>'
                '<span class="hbadge">&#127909; Video</span>'
                '<span class="hbadge">&#127760; 5 Languages</span>'
                "</div>"
            )

        with gr.Column(elem_classes="panel search-card"):
            gr.Markdown('<span class="pill-label">Your question</span>')
            query_input = gr.Textbox(
                show_label=False,
                placeholder=(
                    "\U0001F50D Ask anything \u2014 e.g., What is the Preventive "
                    "System methodology?"
                ),
                lines=1,
                max_lines=4,
            )
            with gr.Row(elem_classes="search-actions"):
                submit_btn = gr.Button(
                    "\u2728 Search & Analyze",
                    variant="primary",
                    elem_classes="btn-primary",
                    scale=3,
                )
                clear_btn = gr.Button(
                    "\u2715 Clear",
                    elem_classes="btn-secondary",
                    scale=1,
                )

        with gr.Row(elem_classes="panel toolbar-row"):
            with gr.Column(elem_classes="field-media", scale=1, min_width=200):
                gr.Markdown('<span class="pill-label">Filter by media type</span>')
                media_filter = gr.Dropdown(
                    choices=["All", "PDF", "Document", "Presentation", "Audio", "Image", "Video"],
                    value="All",
                    show_label=False,
                    container=False,
                )
            with gr.Column(elem_classes="field-lang", scale=2):
                gr.Markdown('<span class="pill-label">Response language</span>')
                lang_radio = gr.Radio(
                    choices=_LANG_CHOICES,
                    value=_LANG_CHOICES[0],
                    show_label=False,
                    elem_classes="lang-radio",
                    interactive=True,
                )

        with gr.Column(elem_classes="results-area"):
            with gr.Row(elem_classes="content-row"):
                with gr.Column(scale=3, elem_classes="answer-column"):
                    gr.Markdown(
                        '<span class="section-chip">&#128172; Answer</span>',
                        elem_classes="results-chip-md",
                    )
                    answer_output = gr.Markdown(
                        value=_ANSWER_PLACEHOLDER,
                        show_label=False,
                        elem_classes="answer-panel-card",
                    )
                with gr.Column(scale=1, elem_classes="sources-column", min_width=260):
                    gr.Markdown(
                        '<span class="section-chip">&#128218; Retrieved Sources</span>',
                        elem_classes="results-chip-md",
                    )
                    sources_output = gr.Markdown(
                        value=_SOURCES_PLACEHOLDER,
                        show_label=False,
                        elem_classes="sources-panel-card",
                    )

        gr.Markdown(
            '<footer class="gsdp-footer">'
            '<div class="gsdp-footer-logo">\U0001F30D&nbsp;&nbsp;Global Salesian Digital '
            "Platform Semantic Search</div>"
            '<div class="gsdp-footer-sub">Powered by Bosco Soft Technologies '
            "Pvt Ltd&nbsp;&nbsp;&middot;&nbsp;&nbsp;Multilingual Salesian Knowledge "
            "Corpus</div></footer>"
        )

        # Full-page loading overlay (hidden by default)
        loading_overlay = gr.HTML(
            value=(
                '<div class="fullpage-loader">'
                '<div class="loader-content">'
                '<div class="loader-spinner"></div>'
                '<div class="loader-text">Searching the Knowledge Base...</div>'
                '<div class="loader-subtext">Please wait while we find relevant documents and generate your answer.</div>'
                '</div></div>'
            ),
            visible=False,
            elem_classes="fullpage-loader-wrapper",
        )

        # Event handlers: show full-page loader → run search → hide loader
        submit_btn.click(
            fn=lambda: gr.update(visible=True),
            outputs=[loading_overlay],
        ).then(
            fn=chat,
            inputs=[query_input, media_filter],
            outputs=[answer_output, sources_output],
        ).then(
            fn=lambda: gr.update(visible=False),
            outputs=[loading_overlay],
        )
        query_input.submit(
            fn=lambda: gr.update(visible=True),
            outputs=[loading_overlay],
        ).then(
            fn=chat,
            inputs=[query_input, media_filter],
            outputs=[answer_output, sources_output],
        ).then(
            fn=lambda: gr.update(visible=False),
            outputs=[loading_overlay],
        )
        lang_radio.change(
            fn=switch_language,
            inputs=[lang_radio],
            outputs=[answer_output],
        )
        clear_btn.click(
            fn=lambda: ("", _ANSWER_PLACEHOLDER, _SOURCES_PLACEHOLDER),
            outputs=[query_input, answer_output, sources_output],
        )

    app.show_api = False
    return app


def mount_rag_ui(fastapi_app: FastAPI, path: str = "/rag") -> None:
    """Mount the Gradio RAG UI on the main FastAPI application."""
    gr.mount_gradio_app(fastapi_app, create_app(), path=path)



# ============================================================
# APPLICATION ENTRY POINT
# ============================================================
# app = FastAPI()
# mount_rag_ui(app, path="/")

# if __name__ == "__main__":
#     import uvicorn
#     port = int(os.environ.get("PORT", 8080))
#     print(f"Starting GSDP Semantic Search on port {port}...")
#     uvicorn.run(app, host="0.0.0.0", port=port)