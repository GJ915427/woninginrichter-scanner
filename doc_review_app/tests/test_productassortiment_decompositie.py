"""
Testsuite ter verificatie van de decompositie van het product- en dienstenassortiment
(EasyM2M MVP Scope, Profiel A exclusief karpetten).

Toetst:
1. Fysieke aanwezigheid van productassortiment_decompositie.md in local_documents/.
2. Aanwezigheid en integriteit van alle 6 categorieën (incl. Categorie 6 Diensten).
3. Profiel A scope-afbakening (exclusief karpetten).
4. MVP-arbeidsafbakening (handmatig / ERP-delegatie).
5. Deurenbeleid: strikte taakafbakening (uitsluitend adviserend, geen zaagwerk door monteurs).
6. Formele normeringen (NEN 2741, NEN-EN 13561 windklasse 6, NEN 2608, NEN-EN 1627 RC2/RC3).
"""

from pathlib import Path
import pytest

DOCUMENTS_DIR = Path(__file__).resolve().parent.parent / "local_documents"
DECOMPOSITIE_PATH = DOCUMENTS_DIR / "productassortiment_decompositie.md"


def _read_decompositie() -> str:
    assert DECOMPOSITIE_PATH.is_file(), f"Document niet gevonden: {DECOMPOSITIE_PATH}"
    return DECOMPOSITIE_PATH.read_text(encoding="utf-8")


@pytest.fixture
def decompositie_content() -> str:
    return _read_decompositie()


def test_decompositie_file_exists():
    """Toetst of productassortiment_decompositie.md fysiek bestaat in doc_review_app/local_documents/."""
    assert DECOMPOSITIE_PATH.exists(), f"Bestand ontbreekt in local_documents: {DECOMPOSITIE_PATH}"
    assert DECOMPOSITIE_PATH.is_file()
    assert DECOMPOSITIE_PATH.stat().st_size > 5000, "Bestand is onverwacht klein of leeg"


def test_decompositie_categories(decompositie_content: str):
    """Toetst of exact alle 6 categorieën volwaardig aanwezig zijn in de taxonomie."""
    # 1. Mermaid diagram C1 t/m C6 aanwezigheid
    assert 'C1["1. Gordijnen & Rails"]' in decompositie_content
    assert 'C2["2. Raamdecoratie, Binnenzonwering' in decompositie_content
    assert 'C3["3. Vaste Vloerbekleding' in decompositie_content
    assert 'C4["4. Trapbekleding, Traprenovatie' in decompositie_content
    assert 'C5["5. Buitenzonwering, Gevelsystemen' in decompositie_content
    assert 'C6["6. Diensten, Montage & Logistiek' in decompositie_content

    # 2. Hoofdstuktitels aanwezigheid
    assert "## 1. Gordijnen & Rails" in decompositie_content
    assert "## 2. Raamdecoratie (Binnenzonwering & Horren)" in decompositie_content
    assert "## 3. Vaste Vloerbekleding & Dekvloertechniek" in decompositie_content
    assert "## 4. Trapbekleding, Traprenovatie & Trapelementen" in decompositie_content
    assert "## 5. Buitenzonwering, Gevelsystemen & Rolluiken" in decompositie_content
    assert "## 6. Diensten, Montage & Montagelogistiek (Domein III)" in decompositie_content


def test_decompositie_scope_profiel_a(decompositie_content: str):
    """Toetst of Profiel A expliciet karpetten uitsluit van de MVP-scope."""
    assert "Profiel A (Maatwerk Woningstoffering & Gevelsystemen, exclusief karpetten)" in decompositie_content
    assert "losse karpetten vallen buiten de kern van deze configuratiescope" in decompositie_content


def test_decompositie_mvp_arbeid(decompositie_content: str):
    """Toetst of de MVP-afbakening voor arbeid (handmatig / ERP) helder is verankerd."""
    assert "In de MVP van EasyM2M worden alle berekeningen m.b.t. arbeid handmatig ingevoerd en/of afgehandeld in het ERP-systeem" in decompositie_content
    assert "Geautomatiseerde arbeidsberekening is dus geen onderdeel van de EasyM2M MVP" in decompositie_content
    assert "LogicTrade" in decompositie_content
    assert "AFAS" in decompositie_content


def test_decompositie_deuren_beleid(decompositie_content: str):
    """Toetst de tri-pillar harmonisatie van het deurenbeleid (uitsluitend adviserend, geen zaagwerk door monteurs)."""
    # 1. Mermaid node C6_2 check
    assert 'C6_2["Deurinspectie & Knelpuntenadvies (Geen Uitvoering)"]' in decompositie_content
    assert 'Timmerwerk (Deuren Inkorten' not in decompositie_content

    # 2. Sectie 6.3 kop en tekst check
    assert "### 6.3 Deurinspectie & Beleid Deuren Inkorten (Strikte Taakafbakening)" in decompositie_content
    assert "definitief géén zaag- of schaafwerkzaamheden aan binnendeuren" in decompositie_content
    assert "Signalerend adviespunt" in decompositie_content
    assert "< 4 mm" in decompositie_content

    # 3. Samenvattingstabel check
    assert "deurenadvies (stuks knelpunten)" in decompositie_content
    assert "deuren inkorten (stuks)" not in decompositie_content


def test_decompositie_normeringen(decompositie_content: str):
    """Toetst de formele NEN-normeringen in de decompositie."""
    assert "NEN 2741" in decompositie_content  # Carbid-vochtmeting vloeren
    assert "NEN-EN 13561" in decompositie_content  # Windklasse screens
    assert "Windklasse 6" in decompositie_content or "windklasse 6" in decompositie_content
    assert "NEN 2608" in decompositie_content  # Valbeveiliging verdiepingen
    assert "NEN-EN 1627" in decompositie_content  # Inbraakwerendheid rolluiken RC2/RC3
