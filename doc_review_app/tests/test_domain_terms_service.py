"""Unit tests for DomainTermsService (v51 domain terminology extraction).
Verifies single-word hotwords extraction, multi-word phrase prompt conditioning,
stopword filtering, and token budget clamping.
"""

from pathlib import Path
import pytest
from doc_review_app.services.domain_terms_service import DomainTermsService


@pytest.fixture
def sample_v51_markdown(tmp_path: Path) -> Path:
    sample_content = """# Domeinmodel Woninginrichting v51

## Deel 2: Begrippen en Taxonomie

| Begrip | Type | Status | Omschrijving |
| :--- | :--- | :--- | :--- |
| dagmaat | Maatvoering | Ja | Binnenwerkse breedte of hoogte in mm |
| railroede | Ophangsysteem | Fase 1 | Decoratieve rail voor gordijnen |
| confectiehoogte | Productie | Actief | Hoogte van het geconfectioneerde gordijn |
| montagehoogte | Plaatsing | Nee | Hoogte van vloer tot bovenzijde rail |
| blijvende maat | Maatvoering | Definitief | Maat na krimp of rek correctie |
| begane grond | Ruimte | Standaard | Verdieping op straatniveau |
| in de dag | Montage | Actief | Plaatsing tussen de muren |
| op de dag | Montage | Actief | Plaatsing voor de opening over de muur |

### Deel 3: Technische Tabellen
| Eigenschap | Waarde | Eenheid |
| :--- | :--- | :--- |
| plooibreedte | 80 | mm |
| overlap | 50 | mm |
"""
    doc_path = tmp_path / "domeinmodel_sample.md"
    doc_path.write_text(sample_content, encoding="utf-8")
    return doc_path


def test_domain_terms_extraction_single_words(sample_v51_markdown: Path):
    service = DomainTermsService(domain_terms_file=sample_v51_markdown)
    hotwords = service.get_hotwords()
    assert isinstance(hotwords, str)
    # Check space-separated string
    words = hotwords.split()
    assert "dagmaat" in words
    assert "railroede" in words
    assert "confectiehoogte" in words
    assert "montagehoogte" in words
    assert "plooibreedte" in words


def test_domain_terms_stopwords_filtered(sample_v51_markdown: Path):
    service = DomainTermsService(domain_terms_file=sample_v51_markdown)
    hotwords = service.get_hotwords().lower()
    words = set(hotwords.split())
    # Generic stopwords must be filtered out
    for stopword in ["status", "fase", "ja", "nee", "type", "omschrijving", "mm", "waarde"]:
        assert stopword not in words


def test_domain_terms_initial_prompt_phrases(sample_v51_markdown: Path):
    service = DomainTermsService(domain_terms_file=sample_v51_markdown)
    prompt = service.get_initial_prompt()
    assert isinstance(prompt, str)
    assert len(prompt) > 0
    # Multi-word concepts should be in initial_prompt
    assert "blijvende maat" in prompt or "begane grond" in prompt or "in de dag" in prompt


def test_domain_terms_budget_clamping(sample_v51_markdown: Path):
    service = DomainTermsService(domain_terms_file=sample_v51_markdown, max_tokens=150, max_terms=50)
    hotwords = service.get_hotwords()
    # At most 50 words
    words = hotwords.split()
    assert len(words) <= 50


def test_domain_terms_missing_file_fallback(tmp_path: Path):
    missing_file = tmp_path / "non_existent.md"
    service = DomainTermsService(domain_terms_file=missing_file)
    assert service.get_hotwords() == ""
    assert service.get_initial_prompt() == ""
