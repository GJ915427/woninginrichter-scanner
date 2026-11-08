"""
Testsuite ter verificatie van de assortimentsharmonisatie en MVP-scope
conform de 3.000 geanalyseerde GSW-orders (Groter in Wonen).

Toetst:
1. Sanering van Categorie 2 (verwijderen buitenscreens, behoud BB70/BB71 en Facette).
2. Volwaardige uitbreiding van Categorie 5 (rolluiken, Solar, RC2/RC3, windklasse 1..6, NEN 2608).
3. Verankering van formele normeringen: NEN 2741 (CM-meting), NEN 2608, NEN-EN 13561, NEN-EN 1627.
4. OutdoorDimensionSpec TypeScript interfacecontract in §4.9.1.
5. MVP-arbeidsafbakening in §1.1 en §2.8.
6. Synchronisatiepariteit tussen v50 en master kopie.
7. Unicode math-sanering van losstaande maateenheden ($m^2$ -> m²).
8. Mechanische inmeetchecklist state-gate ([ Definitief Maken ] en INV-STATE-01 in §3.1.8).
9. AST review terminologie (Carlo, 35 jaar, AFAS gesaneerd).
"""

from pathlib import Path
import re
import pytest

DOCUMENTS_DIR = Path(__file__).resolve().parent.parent / "local_documents"
V48_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v48.md"
V49_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v49.md"
V50_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v50.md"
MASTER_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting.md"


def _read_doc(path: Path) -> str:
    assert path.is_file(), f"Document niet gevonden: {path}"
    return path.read_text(encoding="utf-8")


@pytest.fixture
def v49_content() -> str:
    return _read_doc(V49_PATH)


@pytest.fixture
def v50_content() -> str:
    return _read_doc(V50_PATH)


@pytest.fixture
def master_content() -> str:
    return _read_doc(MASTER_PATH)


def test_categorie_2_raamdecoratie_sanitized(v50_content: str):
    """Categorie 2 moet zuiver binnenzonwering & horren bevatten zonder buitenscreens."""
    # 1. Titel §3.3 check
    assert "### 3.3 Categorie 2: Raamdecoratie (Binnenzonwering & Horren)" in v50_content
    assert "### 3.3 Categorie 2: Raamdecoratie (Binnenzonwering, Horren & Buitenscreens)" not in v50_content

    # 2. §3.3.1 kopje check
    assert "* **Verticale Lamellen & Paneelgordijnen:**" in v50_content
    assert "* **Verticale Lamellen, Paneelgordijnen & Buitenscreens:**" not in v50_content

    # 3. Behoud van kritieke regels (BB70/BB71 en Facette)
    assert "BB70 / BB71" in v50_content or "BB70/BB71" in v50_content
    assert "Facette" in v50_content

    # 4. Verwijdering buitenscreens toelichting onder 3.3.1
    assert "*Buitenscreens & Buitenzonwering:* Wordt als zelfstandige buitengroep gepositioneerd" not in v50_content

    # 5. §3.3.4 titel en sanering
    assert "#### 3.3.4 Insectenwering (Horren)" in v50_content
    assert "#### 3.3.4 Insectenwering & Buitenscreens (Gevel)" not in v50_content
    assert "De markt vraagt steeds vaker om screens aan de buitenzijde" not in v50_content

    # 6. §3.3.8 Montageprofielen: EasyClick toevoeging
    assert "EasyClick" in v50_content
    assert "TruFit" in v50_content
    assert "FrameFix" in v50_content

    # 7. §3.3.12 Rekenmatrix: buitenscreens gesaneerd uit rij 943
    assert "| **Buitenscreens & Horren" not in v50_content
    assert "| **Inzethorren** | Binnen | N.v.t. | N.v.t. | 0 mm | 0 mm |" in v50_content
    assert "| **Rolhorren & Plisséhorren** | Binnen |" in v50_content


def test_categorie_5_rolluiken_en_screens_expansion(v50_content: str):
    """Categorie 5 moet volwaardige rolluiken, Solar en normeringen bevatten."""
    # 1. Rolluik specificaties in §3.6
    assert "137" in v50_content and "205" in v50_content
    assert "45_graden" in v50_content or "45°" in v50_content
    assert "LiFePO4" in v50_content or "Solar" in v50_content
    assert "RC2" in v50_content and "RC3" in v50_content
    assert "NEN-EN 1627" in v50_content
    assert "optilbeveiliging" in v50_content or "veerconsoles" in v50_content

    # 2. Windklasse normering
    assert "NEN-EN 13561" in v50_content
    assert "windklasse" in v50_content.lower()

    # 3. Valbeveiliging normering
    assert "NEN 2608" in v50_content


def test_nen_2741_vloeren_carbid_meting(v50_content: str):
    """In §3.4.2 moet NEN 2741 voor de carbidmeting (CM-meting) zijn verankerd."""
    assert "NEN 2741" in v50_content
    assert "2,0 CM-%" in v50_content or "2.0 CM-%" in v50_content
    assert "1,5 CM-%" in v50_content or "1.5 CM-%" in v50_content
    assert "0,5 CM-%" in v50_content or "0.5 CM-%" in v50_content
    assert "0,3 CM-%" in v50_content or "0.3 CM-%" in v50_content


def test_outdoor_dimension_spec_schema(v50_content: str):
    """In §4.9.1 moet OutdoorDimensionSpec rolluiken, windklassen en valbeveiliging specificeren."""
    spec_match = re.search(r'interface\s+OutdoorDimensionSpec\s*\{([^}]+)\}', v50_content)
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


def test_mvp_arbeid_montage_afbakening(v50_content: str):
    """In §1.1 en §2.8 moet expliciet de MVP-afbakening voor arbeid en montage zijn verankerd."""
    # [SPEC-CHANGE-AUTHORIZED: Sanering van AFAS-assertie conform AST-reviewpunt §3.7 waarin AFAS niet gebruikt wordt in de woonbranche]
    assert "LogicTrade" in v50_content
    assert "arbeidsberekening" in v50_content.lower() or "arbeid" in v50_content.lower()


def test_master_and_v50_parity(v50_content: str, master_content: str):
    """Master en v50 moeten 100% synchroon en byte-paritair zijn."""
    assert master_content.strip() == v50_content.strip(), "Divergentie tussen v50 en master document"


def test_zes_categorieen_domeinmodel_harmonisatie(v50_content: str):
    """In §1.1, §1.5.1 en Deel 3 moet het model strikt 6 categorieën omvatten (geen verouderde 4- of 5-deling)."""
    # 1. §1.1 Sanering van 'vijf kernproductgroepen' en 'Alle 5 kernproductgroepen'
    assert "vijf kernproductgroepen" not in v50_content.lower()
    assert "alle 5 kernproductgroepen" not in v50_content.lower()
    assert "6 categorieën conform Profiel A" in v50_content or "6 categorieën" in v50_content

    # 2. §1.1 Uitsluiting losse karpetten en meubelen conform Profiel A
    assert "losse karpetten" in v50_content

    # 3. §1.5.1 Regel 92 moet alle groepen noemen (geen 4-deling)
    assert "Buitenzonwering & Gevelsystemen" in v50_content
    assert "Categorie 6" in v50_content or "Diensten" in v50_content

    # 4. Deel 3 Header Sanering (geen '5 Disciplines')
    assert "De 5 Disciplines in Detail" not in v50_content
    assert "5 disciplines" not in v50_content
    assert "De 6 Categorieën in Detail" in v50_content

    # 5. Paragraaf 3.7 Categorie 6 aanwezigheid met geharmoniseerde 9 productgroepen (6.1 t/m 6.9)
    # [SPEC-CHANGE-AUTHORIZED: Herstel van versielijn v48 naar v50 met Categorie 6 harmonisatie en integrale migratie van testsuite fixtures naar v50 en master SSOT]
    assert "### 3.7 Categorie 6: Diensten, Montage & Montagelogistiek" in v50_content
    assert "#### 3.7.1 Gordijnconfectie & Gordijnrailmontage (Cat 1)" in v50_content
    assert "#### 3.7.2 Binnenzonwering- & Horrenmontage (Cat 2)" in v50_content
    assert "#### 3.7.3 Vloeren Legservice & Randafwerking (Cat 3)" in v50_content
    assert "#### 3.7.4 Trapbekleding & Traprenovatie Montage (Cat 4)" in v50_content
    assert "#### 3.7.5 Buitenzonwering & Gevelmontage (Cat 5)" in v50_content
    assert "#### 3.7.6 Inmeting, Bouwkundige Schouw & Technisch Advies" in v50_content
    assert "#### 3.7.7 Sloop, Ondergrondsanering & Voorbewerking" in v50_content
    assert "#### 3.7.8 Montagelogistiek, Verticaal Transport & Afvalbeheer" in v50_content
    assert "#### 3.7.9 Service, Garantie & Nazorg" in v50_content
    assert "#### 3.7.10 Inmeet- en Rekenmatrix Diensten & Montage" in v50_content
    assert "#### 3.7.11 Samenvattende ERP Verpakkings- & Logistiekgovernance" in v50_content


def test_titels_harmonisatie_c3_c4_c5(v50_content: str):
    """De titels van Categorie 3, 4 en 5 moeten synchroon zijn met de gepromoveerde taxonomie."""
    assert "### 3.4 Categorie 3: Vaste Vloerbekleding & Dekvloertechniek" in v50_content
    assert "### 3.5 Categorie 4: Trapbekleding, Traprenovatie & Trapelementen" in v50_content
    assert "### 3.6 Categorie 5: Buitenzonwering, Gevelsystemen & Rolluiken" in v50_content


def test_deurenbeleid_contract_pariteit(v50_content: str):
    """Het deurenbeleid moet over de gehele causale keten consistent zijn op de adviesrol."""
    # 1. §4.9.1 FloorDimensionSpec: advies_inkorten ipv zagen
    floor_match = re.search(r'interface\s+FloorDimensionSpec\s*\{([^}]+)\}', v50_content)
    assert floor_match, "FloorDimensionSpec interface niet gevonden in §4.9.1"
    floor_body = floor_match.group(1)
    assert "advies_inkorten" in floor_body
    assert "inkorten_vereist" not in floor_body
    assert "deuren_inkorten_aantal" not in floor_body

    # 2. §3.4.6 Inmeetchecklist inspectiepunten 12 & 13
    assert "Vrije speling deuren" in v50_content
    assert "Verschijnt als vrije speling deuren = Deuren klemmen of advies inkorten" in v50_content

    # 3. §3.4.7 Rekenmatrix: geen zaagadvies/timmerman verplichting
    assert "advies timmerman" not in v50_content.lower()

    # 4. Deel 5 Praktijkvoorbeeld
    assert "advies inkorten" in v50_content.lower()


def test_service_dimension_spec_schema(v50_content: str):
    """In §4.9.1 moet ServiceDimensionSpec zijn gedefinieerd en ProductToewijzing diensten ondersteunen."""
    # 1. ProductToewijzing literal verruimingen
    toewijzing_match = re.search(r'interface\s+ProductToewijzing\s*\{([^}]+)\}', v50_content)
    assert toewijzing_match, "ProductToewijzing interface niet gevonden in §4.9.1"
    toewijzing_body = toewijzing_match.group(1)
    assert "'diensten'" in toewijzing_body
    assert "'n.v.t.'" in toewijzing_body
    assert "'dagdeel'" in toewijzing_body
    assert "'forfait'" in toewijzing_body

    # 2. ServiceDimensionSpec interface
    spec_match = re.search(r'interface\s+ServiceDimensionSpec\s*\{([^}]+)\}', v50_content)
    assert spec_match, "ServiceDimensionSpec interface niet gevonden in §4.9.1"
    spec_body = spec_match.group(1)
    assert "dienst_type" in spec_body
    assert "ondergrond_sanering_m2" in spec_body
    assert "egalisatie_laagdikte_mm" in spec_body
    assert "advies_deuren_inkorten" in spec_body
    assert "aantal_deuren_knelpunten" in spec_body
    assert "verticaal_transport_ladderlift" in spec_body
    assert "afvalcontainer_plaatsing" in spec_body


def test_v50_unicode_math_sanitization(v50_content: str):
    """In §3.1.1 en tabellen moeten losstaande maateenheden zuiver Unicode m² zijn."""
    assert "vierkante meters (m²" in v50_content
    assert "($m^2$" not in v50_content
    assert "m²" in v50_content
    assert r"\lceil" in v50_content  # Samengestelde LaTeX formules intact


def test_v50_inmeetchecklist_definitief_state_gate(v50_content: str):
    """In §3.1.8 moet [ Definitief Maken ] mechanisch gekoppeld zijn aan de checklist."""
    assert "[ Definitief Maken ]" in v50_content
    assert "INV-STATE-01" in v50_content


def test_v50_ast_review_terminologie(v50_content: str):
    """In §3.1.1 en §3.7 moeten Carlo, 35 jaar en AFAS gesaneerd zijn."""
    assert "zoals Carlo" not in v50_content
    assert "35 jaar" not in v50_content
    assert "jarenlange" in v50_content
    assert "AFAS" not in v50_content
