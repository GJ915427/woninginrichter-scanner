"""Domain terminology extractor service based on SSOT domeinmodel_woninginrichting_v51.md.

Extracts domain specific terminology, applies stopword filtering and token budget clamping,
and provides bimodal conditioning:
- Space-separated single-word compounds for faster-whisper hotwords
- Natural grammatical context sentence for initial_prompt
"""

from pathlib import Path
import re
from typing import List, Optional, Set, Tuple
from doc_review_app.config import settings


DEFAULT_STOPWORDS: Set[str] = {
    "status", "fase", "ja", "nee", "type", "omschrijving", "mm", "cm", "m",
    "waarde", "eenheid", "begrip", "eigenschap", "deel", "tabel", "naam",
    "actief", "definitief", "standaard", "plaatsing", "productie",
    "maatvoering", "ruimte", "montage", "toelichting", "nr", "code",
    "in", "de", "het", "een", "van", "voor", "op", "met", "en", "of", "tot"
}


class DomainTermsService:
    """Service to parse, filter and budget domain terminology from v51 model."""

    def __init__(
        self,
        domain_terms_file: Optional[Path] = None,
        max_tokens: int = 150,
        max_terms: int = 50,
    ) -> None:
        self.domain_terms_file = domain_terms_file or settings.domain_terms_file
        self.max_tokens = max_tokens
        self.max_terms = max_terms
        self._cached_mtime: Optional[float] = None
        self._cached_hotwords: str = ""
        self._cached_initial_prompt: str = ""

    def _should_refresh(self) -> bool:
        if not self.domain_terms_file or not self.domain_terms_file.is_file():
            return False
        current_mtime = self.domain_terms_file.stat().st_mtime
        return self._cached_mtime != current_mtime

    def _parse_model(self) -> Tuple[List[str], List[str]]:
        """Parses markdown and returns (single_words, phrases)."""
        if not self.domain_terms_file or not self.domain_terms_file.is_file():
            return [], []

        try:
            content = self.domain_terms_file.read_text(encoding="utf-8", errors="replace")
        except Exception:
            return [], []

        single_words: List[str] = []
        phrases: List[str] = []
        seen_terms: Set[str] = set()

        for line in content.splitlines():
            line = line.strip()
            # Parse Markdown table rows: | col1 | col2 | ...
            if line.startswith("|") and not re.search(r"^\|\s*:?-+:?\s*\|", line):
                cols = [c.strip() for c in line.split("|")[1:-1]]
                if not cols:
                    continue
                term_cand = cols[0].strip().strip("*`_").lower()
                # Skip header rows and empty tokens
                if not term_cand or term_cand in DEFAULT_STOPWORDS or "begrip" in term_cand:
                    continue

                if " " in term_cand:
                    # Multi-word phrase
                    words = term_cand.split()
                    if len(words) in (2, 3) and not all(w in DEFAULT_STOPWORDS for w in words):
                        if term_cand not in seen_terms:
                            seen_terms.add(term_cand)
                            phrases.append(term_cand)
                else:
                    # Single word compound
                    clean_word = re.sub(r"[^a-zA-Z0-9\-]", "", term_cand)
                    if len(clean_word) >= 4 and clean_word not in DEFAULT_STOPWORDS:
                        if clean_word not in seen_terms:
                            seen_terms.add(clean_word)
                            single_words.append(clean_word)

            # Parse markdown headings with bold/definitions
            elif line.startswith("#"):
                heading_text = re.sub(r"^#+\s*", "", line).strip().strip("*`_").lower()
                for token in re.findall(r"[a-zA-Z0-9\-]{5,}", heading_text):
                    if token not in DEFAULT_STOPWORDS and token not in seen_terms:
                        seen_terms.add(token)
                        single_words.append(token)

        return single_words, phrases

    def _refresh_if_needed(self) -> None:
        if self._cached_mtime is not None and not self._should_refresh():
            return

        if not self.domain_terms_file or not self.domain_terms_file.is_file():
            self._cached_hotwords = ""
            self._cached_initial_prompt = ""
            self._cached_mtime = None
            return

        self._cached_mtime = self.domain_terms_file.stat().st_mtime
        single_words, phrases = self._parse_model()

        # Clamp single words to max_terms and token budget
        budgeted_words: List[str] = []
        token_count = 0
        for word in single_words:
            word_tokens = max(1, len(word) // 4)
            if token_count + word_tokens > self.max_tokens or len(budgeted_words) >= self.max_terms:
                break
            budgeted_words.append(word)
            token_count += word_tokens

        self._cached_hotwords = " ".join(budgeted_words)

        # Formulate grammatical initial_prompt with top phrases
        clamped_phrases = phrases[:10]
        if clamped_phrases:
            phrase_str = ", ".join(clamped_phrases)
            self._cached_initial_prompt = f"Review notities betreffende woninginrichting: {phrase_str}."
        else:
            self._cached_initial_prompt = ""

    def get_hotwords(self) -> str:
        """Returns space-separated single-word domain terms for faster-whisper biasing."""
        self._refresh_if_needed()
        return self._cached_hotwords

    def get_initial_prompt(self) -> str:
        """Returns initial prompt context sentence for multi-word domain concepts."""
        self._refresh_if_needed()
        return self._cached_initial_prompt


# Singleton instance
domain_terms_service = DomainTermsService()
