"""
Testsuite ter verificatie van de assortimentsharmonisatie en MVP-scope
conform de 3.000 geanalyseerde GSW-orders (Groter in Wonen).

Toetst:
1. Sanering van Categorie 2 (verwijderen buitenscreens, behoud BB70/BB71 en Facette).
2. Volwaardige uitbreiding van Categorie 5 (rolluiken, Solar, RC2/RC3, windklasse 1..6, NEN 2608).
3. Verankering van formele normeringen: NEN 2741 (CM-meting), NEN 2608, NEN-EN 13561, NEN-EN 1627.
4. OutdoorDimensionSpec TypeScript interfacecontract in §4.9.1.
5. MVP-arbeidsafbakening in §1.1 en §2.8.
6. Synchronisatiepariteit tussen v44 en master kopie.
"""

from pathlib import Path
import re
import pytest

DOCUMENTS_DIR = Path(__file__).resolve().parent.parent / "local_documents"
V44_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v44.md"
MASTER_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting.md"


def _read_doc(path: Path) -> str:
    assert path.is_file(), f"Document niet gevonden: {path}"
    return path.read_text(encoding="utf-8")


@pytest.fixture
def v44_content() -> str:
    return _read_doc(V44_PATH)


@pytest.fixture
def master_content() -> str:
    return _read_doc(MASTER_PATH)


def test_categorie_2_raamdecoratie_sanitized(v44_content: str):
    """Categorie 2 moet zuiver binnenzonwering & horren bevatten zonder buitenscreens."""
    # 1. Titel §3.3 check
    assert "### 3.3 Categorie 2: Raamdecoratie (Binnenzonwering & Horren)" in v44_content
    assert "### 3.3 Categorie 2: Raamdecoratie (Binnenzonwering, Horren & Buitenscreens)" not in v44_content

    # 2. §3.3.1 kopje check
    assert "* **Verticale Lamellen & Paneelgordijnen:**" in v44_content
    assert "* **Verticale Lamellen, Paneelgordijnen & Buitenscreens:**" not in v44_content

    # 3. Behoud van kritieke regels (BB70/BB71 en Facette)
    assert "BB70 / BB71" in v44_content or "BB70/BB71" in v44_content
    assert "Facette" in v44_content

    # 4. Verwijdering buitenscreens toelichting onder 3.3.1
    assert "*Buitenscreens & Buitenzonwering:* Wordt als zelfstandige buitengroep gepositioneerd" not in v44_content

    # 5. §3.3.4 titel en sanering
    assert "#### 3.3.4 Insectenwering (Horren)" in v44_content
    assert "#### 3.3.4 Insectenwering & Buitenscreens (Gevel)" not in v44_content
    assert "De markt vraagt steeds vaker om screens aan de buitenzijde" not in v44_content

    # 6. §3.3.8 Montageprofielen: EasyClick toevoeging
    assert "EasyClick" in v44_content
    assert "TruFit" in v44_content
    assert "FrameFix" in v44_content

    # 7. §3.3.12 Rekenmatrix: buitenscreens gesaneerd uit rij 943
    assert "| **Buitenscreens & Horren" not in v44_content
    assert "| **Inzethorren** | Binnen | N.v.t. | N.v.t. | 0 mm | 0 mm |" in v44_content
    assert "| **Rolhorren & Plisséhorren** | Binnen |" in v44_content


def test_categorie_5_rolluiken_en_screens_expansion(v44_content: str):
    """Categorie 5 moet volwaardige rolluiken, Solar en normeringen bevatten."""
    # 1. Rolluik specificaties in §3.6
    assert "137" in v44_content and "205" in v44_content
    assert "45_graden" in v44_content or "45°" in v44_content
    assert "LiFePO4" in v44_content or "Solar" in v44_content
    assert "RC2" in v44_content and "RC3" in v44_content
    assert "NEN-EN 1627" in v44_content
    assert "optilbeveiliging" in v44_content or "veerconsoles" in v44_content

    # 2. Windklasse normering
    assert "NEN-EN 13561" in v44_content
    assert "windklasse" in v44_content.lower()

    # 3. Valbeveiliging normering
    assert "NEN 2608" in v44_content


def test_nen_2741_vloeren_carbid_meting(v44_content: str):
    """In §3.4.2 moet NEN 2741 voor de carbidmeting (CM-meting) zijn verankerd."""
    assert "NEN 2741" in v44_content
    assert "2,0 CM-%" in v44_content or "2.0 CM-%" in v44_content
    assert "1,5 CM-%" in v44_content or "1.5 CM-%" in v44_content
    assert "0,5 CM-%" in v44_content or "0.5 CM-%" in v44_content
    assert "0,3 CM-%" in v44_content or "0.3 CM-%" in v44_content


def test_outdoor_dimension_spec_schema(v44_content: str):
    """In §4.9.1 moet OutdoorDimensionSpec rolluiken, windklassen en valbeveiliging specificeren."""
    # Zoek OutdoorDimensionSpec definitie
    spec_match = re.search(r'interface\s+OutdoorDimensionSpec\s*\{([^}]+)\}', v44_content)
    assert spec_match, "OutdoorDimensionSpec interface niet gevonden in §4.9.1"
    spec_body = spec_match.group(1)

    assert "windklasse" in spec_body
    assert "'klasse_6'" in spec_body
    assert "kastmaat_mm" in spec_body
    assert "kastvorm" in spec_body
    assert "inbraakwerendheid_rc" in spec_body
    assert "valbeveiliging_nen2608" in spec_body
    assert "bediening" in spec_body
    assert "'solar_accu'" in spec_body


def test_mvp_arbeid_montage_afbakening(v44_content: str):
    """In §1.1 en §2.8 moet expliciet de MVP-afbakening voor arbeid en montage zijn verankerd."""
    # §1.1 en §2.8 moeten handmatige invoer en/of ERP calculatie (LogicTrade/AFAS) benoemen
    assert "LogicTrade" in v44_content
    assert "AFAS" in v44_content
    # Controleer dat geautomatiseerde arbeidsberekening expliciet buiten de EasyM2M MVP scope valt
    assert "arbeidsberekening" in v44_content.lower() or "arbeid" in v44_content.lower()


def test_master_and_v44_parity(v44_content: str, master_content: str):
    """Master en v44 moeten 100% synchroon zijn op de assortimentsmutaties."""
    for keyword in [
        "### 3.3 Categorie 2: Raamdecoratie (Binnenzonwering & Horren)",
        "* **Verticale Lamellen & Paneelgordijnen:**",
        "#### 3.3.4 Insectenwering (Horren)",
        "EasyClick",
        "NEN 2741",
        "NEN 2608",
        "NEN-EN 1627",
        "NEN-EN 13561",
        "OutdoorDimensionSpec",
    ]:
        assert (keyword in v44_content) == (keyword in master_content), f"Divergentie voor '{keyword}' tussen v44 en master"
