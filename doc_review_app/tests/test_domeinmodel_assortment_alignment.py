"""
Testsuite ter verificatie van de assortimentsharmonisatie en MVP-scope
conform de 3.000 geanalyseerde GSW-orders (Groter in Wonen) en de
integrale 1NF-normalisatie van het ERD in Versie 51 (V51).

[SPEC-CHANGE-AUTHORIZED: V55 harmonisatie - Domeingesplitst SSOT 2-Assen Model, compile-time exclusie en ketensanering]

Toetst:
1. Sanering van Categorie 2 (verwijderen buitenscreens, behoud BB70/BB71 en Facette).
2. Volwaardige uitbreiding van Categorie 5 (rolluiken, Solar, RC2/RC3, windklasse 1..6, NEN 2608).
3. Verankering van formele normeringen: NEN 2741 (CM-meting), NEN 2608, NEN-EN 13561, NEN-EN 1627.
4. OutdoorDimensionSpec TypeScript interfacecontract in §4.9.1.
5. MVP-arbeidsafbakening in §1.1 en §2.8.
6. Synchronisatiepariteit tussen v51 en master kopie.
7. Unicode math-sanering van losstaande maateenheden ($m^2$ -> m²).
8. Mechanische inmeetchecklist state-gate ([ Definitief Maken ] en INV-STATE-01 in §3.1.8).
9. AST review terminologie (Carlo, 35 jaar, AFAS gesaneerd).
10. Integrale 1NF-normalisatie van Positie, PositieMeting, Traptrede, BOMItem en BlindDimensionSpec.
11. Junction tables voor KalenderAfspraak (AfspraakUitvoerder, AfspraakRuimte, AfspraakPositie, AfspraakProduct).
12. Checklist-koppeling (ChecklistVraag, InspectieResultaat) en AuditVeldMutatie in §4.9.1.
"""

from pathlib import Path
import re
import pytest

DOCUMENTS_DIR = Path(__file__).resolve().parent.parent / "local_documents"
V48_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v48.md"
V49_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v49.md"
V50_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v50.md"
V51_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v51.md"
V52_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v52.md"
V53_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v53.md"
V54_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v54.md"
V55_PATH = DOCUMENTS_DIR / "domeinmodel_woninginrichting_v55.md"
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
def v51_content() -> str:
    return _read_doc(V51_PATH)


@pytest.fixture
def v52_content() -> str:
    return _read_doc(V52_PATH)


@pytest.fixture
def v53_content() -> str:
    return _read_doc(V53_PATH)


@pytest.fixture
def v54_content() -> str:
    return _read_doc(V54_PATH)


@pytest.fixture
def v55_content() -> str:
    return _read_doc(V55_PATH)


@pytest.fixture
def master_content() -> str:
    return _read_doc(MASTER_PATH)


def test_categorie_2_raamdecoratie_sanitized(v51_content: str):
    """Categorie 2 moet zuiver binnenzonwering & horren bevatten zonder buitenscreens."""
    # 1. Titel §3.3 check
    assert "### 3.3 Categorie 2: Raamdecoratie (Binnenzonwering & Horren)" in v51_content
    assert "### 3.3 Categorie 2: Raamdecoratie (Binnenzonwering, Horren & Buitenscreens)" not in v51_content

    # 2. §3.3.1 kopje check
    assert "* **Verticale Lamellen & Paneelgordijnen:**" in v51_content
    assert "* **Verticale Lamellen, Paneelgordijnen & Buitenscreens:**" not in v51_content

    # 3. Behoud van kritieke regels (BB70/BB71 en Facette)
    assert "BB70 / BB71" in v51_content or "BB70/BB71" in v51_content
    assert "Facette" in v51_content

    # 4. Verwijdering buitenscreens toelichting onder 3.3.1
    assert "*Buitenscreens & Buitenzonwering:* Wordt als zelfstandige buitengroep gepositioneerd" not in v51_content

    # 5. §3.3.4 titel en sanering
    assert "#### 3.3.4 Insectenwering (Horren)" in v51_content
    assert "#### 3.3.4 Insectenwering & Buitenscreens (Gevel)" not in v51_content
    assert "De markt vraagt steeds vaker om screens aan de buitenzijde" not in v51_content

    # 6. §3.3.8 Montageprofielen: EasyClick toevoeging
    assert "EasyClick" in v51_content
    assert "TruFit" in v51_content
    assert "FrameFix" in v51_content

    # 7. §3.3.12 Rekenmatrix: buitenscreens gesaneerd uit rij 943
    assert "| **Buitenscreens & Horren" not in v51_content
    assert "| **Inzethorren** | Binnen | N.v.t. | N.v.t. | 0 mm | 0 mm |" in v51_content
    assert "| **Rolhorren & Plisséhorren** | Binnen |" in v51_content


def test_categorie_5_rolluiken_en_screens_expansion(v51_content: str):
    """Categorie 5 moet volwaardige rolluiken, Solar en normeringen bevatten."""
    # 1. Rolluik specificaties in §3.6
    assert "137" in v51_content and "205" in v51_content
    assert "45_graden" in v51_content or "45°" in v51_content
    assert "LiFePO4" in v51_content or "Solar" in v51_content
    assert "RC2" in v51_content and "RC3" in v51_content
    assert "NEN-EN 1627" in v51_content
    assert "optilbeveiliging" in v51_content or "veerconsoles" in v51_content

    # 2. Windklasse normering
    assert "NEN-EN 13561" in v51_content
    assert "windklasse" in v51_content.lower()

    # 3. Valbeveiliging normering
    assert "NEN 2608" in v51_content


def test_nen_2741_vloeren_carbid_meting(v51_content: str):
    """In §3.4.2 moet NEN 2741 voor de carbidmeting (CM-meting) zijn verankerd."""
    assert "NEN 2741" in v51_content
    assert "2,0 CM-%" in v51_content or "2.0 CM-%" in v51_content
    assert "1,5 CM-%" in v51_content or "1.5 CM-%" in v51_content
    assert "0,5 CM-%" in v51_content or "0.5 CM-%" in v51_content
    assert "0,3 CM-%" in v51_content or "0.3 CM-%" in v51_content


def test_outdoor_dimension_spec_schema(v51_content: str):
    """In §4.9.1 moet OutdoorDimensionSpec rolluiken, windklassen en valbeveiliging specificeren."""
    spec_match = re.search(r'interface\s+OutdoorDimensionSpec\s*\{([^}]+)\}', v51_content)
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


def test_mvp_arbeid_montage_afbakening(v51_content: str):
    """In §1.1 en §2.8 moet expliciet de MVP-afbakening voor arbeid en montage zijn verankerd."""
    assert "LogicTrade" in v51_content
    assert "arbeidsberekening" in v51_content.lower() or "arbeid" in v51_content.lower()


def test_master_and_v55_parity(v55_content: str, master_content: str):
    """Master en v55 moeten 100% synchroon en byte-paritair zijn."""
    assert master_content.strip() == v55_content.strip(), "Divergentie tussen master en v55 document"


def test_zes_categorieen_domeinmodel_harmonisatie(v51_content: str):
    """In §1.1, §1.5.1 en Deel 3 moet het model strikt 6 categorieën omvatten (geen verouderde 4- of 5-deling)."""
    # 1. §1.1 Sanering van 'vijf kernproductgroepen' en 'Alle 5 kernproductgroepen'
    assert "vijf kernproductgroepen" not in v51_content.lower()
    assert "alle 5 kernproductgroepen" not in v51_content.lower()
    assert "6 categorieën conform Profiel A" in v51_content or "6 categorieën" in v51_content

    # 2. §1.1 Uitsluiting losse karpetten en meubelen conform Profiel A
    assert "losse karpetten" in v51_content

    # 3. §1.5.1 Regel 92 moet alle groepen noemen (geen 4-deling)
    assert "Buitenzonwering & Gevelsystemen" in v51_content
    assert "Categorie 6" in v51_content or "Diensten" in v51_content

    # 4. Deel 3 Header Sanering (geen '5 Disciplines')
    assert "De 5 Disciplines in Detail" not in v51_content
    assert "5 disciplines" not in v51_content
    assert "De 6 Categorieën in Detail" in v51_content

    # 5. Paragraaf 3.7 Categorie 6 aanwezigheid met geharmoniseerde 9 productgroepen (6.1 t/m 6.9)
    assert "### 3.7 Categorie 6: Diensten, Montage & Montagelogistiek" in v51_content
    assert "#### 3.7.1 Gordijnconfectie & Gordijnrailmontage (Cat 1)" in v51_content
    assert "#### 3.7.2 Binnenzonwering- & Horrenmontage (Cat 2)" in v51_content
    assert "#### 3.7.3 Vloeren Legservice & Randafwerking (Cat 3)" in v51_content
    assert "#### 3.7.4 Trapbekleding & Traprenovatie Montage (Cat 4)" in v51_content
    assert "#### 3.7.5 Buitenzonwering & Gevelmontage (Cat 5)" in v51_content
    assert "#### 3.7.6 Inmeting, Bouwkundige Schouw & Technisch Advies" in v51_content
    assert "#### 3.7.7 Sloop, Ondergrondsanering & Voorbewerking" in v51_content
    assert "#### 3.7.8 Montagelogistiek, Verticaal Transport & Afvalbeheer" in v51_content
    assert "#### 3.7.9 Service, Garantie & Nazorg" in v51_content
    assert "#### 3.7.10 Inmeet- en Rekenmatrix Diensten & Montage" in v51_content
    assert "#### 3.7.11 Samenvattende ERP Verpakkings- & Logistiekgovernance" in v51_content


def test_titels_harmonisatie_c3_c4_c5(v51_content: str):
    """De titels van Categorie 3, 4 en 5 moeten synchroon zijn met de gepromoveerde taxonomie."""
    assert "### 3.4 Categorie 3: Vaste Vloerbekleding & Dekvloertechniek" in v51_content
    assert "### 3.5 Categorie 4: Trapbekleding, Traprenovatie & Trapelementen" in v51_content
    assert "### 3.6 Categorie 5: Buitenzonwering, Gevelsystemen & Rolluiken" in v51_content


def test_deurenbeleid_contract_pariteit(v51_content: str):
    """Het deurenbeleid moet over de gehele causale keten consistent zijn op de adviesrol."""
    # 1. §4.9.1 FloorDimensionSpec: advies_inkorten ipv zagen
    floor_match = re.search(r'interface\s+FloorDimensionSpec\s*\{([^}]+)\}', v51_content)
    assert floor_match, "FloorDimensionSpec interface niet gevonden in §4.9.1"
    floor_body = floor_match.group(1)
    assert "advies_inkorten" in floor_body
    assert "inkorten_vereist" not in floor_body
    assert "deuren_inkorten_aantal" not in floor_body

    # 2. §3.4.6 Inmeetchecklist inspectiepunten 12 & 13
    assert "Vrije speling deuren" in v51_content
    assert "Verschijnt als vrije speling deuren = Deuren klemmen of advies inkorten" in v51_content

    # 3. §3.4.7 Rekenmatrix: geen zaagadvies/timmerman verplichting
    assert "advies timmerman" not in v51_content.lower()

    # 4. Deel 5 Praktijkvoorbeeld
    assert "advies inkorten" in v51_content.lower()


def test_service_dimension_spec_schema(v51_content: str):
    """In §4.9.1 moet ServiceDimensionSpec zijn gedefinieerd en ProductToewijzing diensten ondersteunen."""
    # 1. ProductToewijzing literal verruimingen
    toewijzing_match = re.search(r'interface\s+ProductToewijzing\s*\{([^}]+)\}', v51_content)
    assert toewijzing_match, "ProductToewijzing interface niet gevonden in §4.9.1"
    toewijzing_body = toewijzing_match.group(1)
    assert "'diensten'" in toewijzing_body
    assert "'n.v.t.'" in toewijzing_body
    assert "'dagdeel'" in toewijzing_body
    assert "'forfait'" in toewijzing_body

    # 2. ServiceDimensionSpec interface
    spec_match = re.search(r'interface\s+ServiceDimensionSpec\s*\{([^}]+)\}', v51_content)
    assert spec_match, "ServiceDimensionSpec interface niet gevonden in §4.9.1"
    spec_body = spec_match.group(1)
    assert "dienst_type" in spec_body
    assert "ondergrond_sanering_m2" in spec_body
    assert "egalisatie_laagdikte_mm" in spec_body
    assert "advies_deuren_inkorten" in spec_body
    assert "aantal_deuren_knelpunten" in spec_body
    assert "verticaal_transport_ladderlift" in spec_body
    assert "afvalcontainer_plaatsing" in spec_body


def test_v50_unicode_math_sanitization(v51_content: str):
    """In §3.1.1 en tabellen moeten losstaande maateenheden zuiver Unicode m² zijn."""
    assert "vierkante meters (m²" in v51_content
    assert "($m^2$" not in v51_content
    assert "m²" in v51_content
    assert r"\lceil" in v51_content  # Samengestelde LaTeX formules intact


def test_v50_inmeetchecklist_definitief_state_gate(v51_content: str):
    """In §3.1.8 moet [ Definitief Maken ] mechanisch gekoppeld zijn aan de checklist."""
    assert "[ Definitief Maken ]" in v51_content
    assert "INV-STATE-01" in v51_content


def test_v50_ast_review_terminologie(v51_content: str):
    """In §3.1.1 en §3.7 moeten Carlo, 35 jaar en AFAS gesaneerd zijn."""
    assert "zoals Carlo" not in v51_content
    assert "35 jaar" not in v51_content
    assert "jarenlange" in v51_content
    assert "AFAS" not in v51_content


def test_erd_1nf_normalization_parity(v51_content: str):
    """Toetst of de 1NF normalisatie van meetwaarden, trappen en BOM sluitend is in §4.9.1."""
    # 1. Positie mag GEEN dagmaat_b1..b3 of dagmaat_h1..h3 bevatten
    pos_match = re.search(r'interface\s+Positie\s*\{([^}]+)\}', v51_content)
    assert pos_match, "Positie interface niet gevonden in §4.9.1"
    pos_body = pos_match.group(1)
    assert "dagmaat_b1_mm" not in pos_body
    assert "dagmaat_h1_mm" not in pos_body
    assert "productiemaat_breedte_mm" not in pos_body
    assert "metingen?: PositieMeting[]" in pos_body or "metingen?:" in pos_body

    # 2. PositieMeting interface moet aanwezig zijn
    assert "interface PositieMeting" in v51_content
    pm_match = re.search(r'interface\s+PositieMeting\s*\{([^}]+)\}', v51_content)
    assert pm_match, "PositieMeting interface niet gevonden in §4.9.1"
    pm_body = pm_match.group(1)
    assert "meetwaarde_type" in pm_body
    assert "as: MeetAs" in pm_body
    assert "waarde_mm: number" in pm_body

    # 3. BlindDimensionSpec mag GEEN b1..b3 of h1..h3 bevatten
    blind_match = re.search(r'interface\s+BlindDimensionSpec\s*\{([^}]+)\}', v51_content)
    assert blind_match, "BlindDimensionSpec interface niet gevonden in §4.9.1"
    blind_body = blind_match.group(1)
    assert "b1_mm" not in blind_body
    assert "h1_mm" not in blind_body
    assert "strakste_dagmaat_b_mm" in blind_body
    assert "productiemaat_b_mm" in blind_body

    # 4. Traptrede en BOMItem aanwezigheid
    assert "interface Traptrede" in v51_content
    assert "interface BOMItem" in v51_content
    stair_match = re.search(r'interface\s+StairDimensionSpec\s*\{([^}]+)\}', v51_content)
    assert stair_match, "StairDimensionSpec interface niet gevonden in §4.9.1"
    stair_body = stair_match.group(1)
    assert "pvc_rechte_dozen_a_4" not in stair_body
    assert "kokers_mammoetlijm" not in stair_body


def test_erd_junction_tables_integrity(v51_content: str):
    """Toetst of planning UUID arrays gesaneerd zijn ten gunste van 4 koppeltabellen."""
    ka_match = re.search(r'interface\s+KalenderAfspraak\s*\{([^}]+)\}', v51_content)
    assert ka_match, "KalenderAfspraak interface niet gevonden in §4.9.1"
    ka_body = ka_match.group(1)
    assert "uitvoerder_ids" not in ka_body
    assert "uitvoerders?: AfspraakUitvoerder[]" in ka_body or "uitvoerders?:" in ka_body
    assert "ruimtes?: AfspraakRuimte[]" in ka_body or "ruimtes?:" in ka_body
    assert "posities?: AfspraakPositie[]" in ka_body or "posities?:" in ka_body
    assert "producten?: AfspraakProduct[]" in ka_body or "producten?:" in ka_body

    # Aanwezigheid koppeltabel interfaces
    assert "interface AfspraakUitvoerder" in v51_content
    assert "interface AfspraakRuimte" in v51_content
    assert "interface AfspraakPositie" in v51_content
    assert "interface AfspraakProduct" in v51_content


def test_erd_checklist_and_audit_entities(v51_content: str):
    """Toetst of ChecklistVraag, InspectieResultaat en AuditVeldMutatie verankerd zijn in §4.9.1."""
    assert "interface ChecklistVraag" in v51_content
    assert "interface InspectieResultaat" in v51_content
    assert "interface AuditVeldMutatie" in v51_content
    assert "interface EntiteitMediaKoppeling" in v51_content

    ir_match = re.search(r'interface\s+InspectieResultaat\s*\{([^}]+)\}', v51_content)
    assert ir_match, "InspectieResultaat interface niet gevonden"
    assert "checklist_vraag_id: string" in ir_match.group(1)

    avm_match = re.search(r'interface\s+AuditVeldMutatie\s*\{([^}]+)\}', v51_content)
    assert avm_match, "AuditVeldMutatie interface niet gevonden"
    assert "'positie_meting'" in avm_match.group(1)


def test_curtain_dimension_spec_chapter_3_alignment(v51_content: str, master_content: str):
    """Toetst of Categorie 1 Gordijnen & Rails (§3.2) volledig is geharmoniseerd in §4.9.1."""
    for content in (v51_content, master_content):
        match = re.search(r'interface\s+CurtainDimensionSpec\s*\{([^}]+)\}', content)
        assert match, "CurtainDimensionSpec interface niet gevonden in §4.9.1"
        body = match.group(1)
        assert "'driedubbel_trio'" in body
        assert "hangwijze?:" in body
        assert "'onder_de_rail'" in body
        assert "'voor_de_rail'" in body
        assert "'meerdelig_stel'" in body
        assert "voering_type?:" in body
        assert "confectiehoogte_mm?:" in body
        assert "rail_roede_type?:" in body
        assert "'elektrisch'" in body


def test_blind_dimension_spec_all_subgroups_and_shutters(v51_content: str, master_content: str):
    """Toetst of Categorie 2 Raamdecoratie alle 12 subgroepen, Shutters en Horren bevat (§3.3)."""
    for content in (v51_content, master_content):
        subgroep_match = re.search(r'type\s+BlindProductSubgroep\s*=\s*([^;]+);', content)
        assert subgroep_match, "BlindProductSubgroep type niet gevonden in §4.9.1"
        subgroep_body = subgroep_match.group(1)
        assert "'shutters'" in subgroep_body
        assert "'duo_rolgordijn'" in subgroep_body
        assert "'insectenwering_hor'" in subgroep_body

        blind_match = re.search(r'interface\s+BlindDimensionSpec\s*\{([^}]+)\}', content)
        assert blind_match, "BlindDimensionSpec interface niet gevonden in §4.9.1"
        blind_body = blind_match.group(1)
        assert "product_subgroep: BlindProductSubgroep" in blind_body
        assert "70" in blind_body
        assert "shutter_kader?:" in blind_body
        assert "'l_kader'" in blind_body
        assert "eos_model_code?:" in blind_body
        assert "hor_type?:" in blind_body
        assert "'oprolbare_hordeur'" in blind_body
        assert "'clearview_ultra_transparant'" in blind_body
        assert "bediening?:" in blind_body


def test_floor_dimension_spec_chapter_3_alignment(v51_content: str, master_content: str):
    """Toetst of Categorie 3 Vaste Vloerbekleding alle vloertypes en 3m vinyl bevat (§3.4)."""
    for content in (v51_content, master_content):
        ft_match = re.search(r'type\s+FloorType\s*=\s*([^;]+);', content)
        assert ft_match, "FloorType type niet gevonden in §4.9.1"
        ft_body = ft_match.group(1)
        assert "'schoonloopzone'" in ft_body
        assert "'dryback_pvc'" in ft_body

        floor_match = re.search(r'interface\s+FloorDimensionSpec\s*\{([^}]+)\}', content)
        assert floor_match, "FloorDimensionSpec interface niet gevonden in §4.9.1"
        floor_body = floor_match.group(1)
        assert "vloertype: FloorType" in floor_body
        assert "3" in floor_body
        assert "ondervloer_type?:" in floor_body
        assert "'rechte_plank'" in floor_body
        assert "matput_afmeting_mm" not in floor_body
        assert "matput_lengte_mm" not in floor_body


def test_stair_dimension_spec_chapter_3_alignment(v51_content: str, master_content: str):
    """Toetst of Categorie 4 Trapbekleding & Traprenovatie laminaat overzettreden en open trap bevat (§3.5)."""
    for content in (v51_content, master_content):
        stair_match = re.search(r'interface\s+StairDimensionSpec\s*\{([^}]+)\}', content)
        assert stair_match, "StairDimensionSpec interface niet gevonden in §4.9.1"
        stair_body = stair_match.group(1)
        assert "'overzettreden_laminaat'" in stair_body
        assert "trap_type?:" in stair_body
        assert "'open_rondom'" in stair_body
        assert "heeft_wangen: boolean" in stair_body
        assert "open_trap_afwerking" not in stair_body
        assert "trapleuning_aantal" not in stair_body
        assert "led_verlichting" not in stair_body


def test_outdoor_dimension_spec_buitenleven_alignment(v51_content: str, master_content: str):
    """Toetst of Categorie 5 Buitenleven en montagewijzen geharmoniseerd zijn (§3.6)."""
    # 1. Historische toetsing op V51 (blijft groen voor historische documenten)
    outdoor_match_v51 = re.search(r'interface\s+OutdoorDimensionSpec\s*\{([^}]+)\}', v51_content)
    assert outdoor_match_v51, "OutdoorDimensionSpec interface niet gevonden in §4.9.1 van V51"
    outdoor_body_v51 = outdoor_match_v51.group(1)
    assert "'lamellendak'" in outdoor_body_v51
    assert "'glazen_schuifwand'" in outdoor_body_v51
    assert "'terrasoverkapping'" in outdoor_body_v51
    assert "'vrijstaand'" in outdoor_body_v51
    assert "bediening?:" in outdoor_body_v51
    assert "'handmatig_schuiven'" in outdoor_body_v51
    assert "motorzijde?:" in outdoor_body_v51
    assert "terrasverwarming_watt" not in outdoor_body_v51
    assert "led_geintegreerd" not in outdoor_body_v51

    toewijzing_match_v51 = re.search(r'interface\s+ProductToewijzing\s*\{([^}]+)\}', v51_content)
    assert toewijzing_match_v51, "ProductToewijzing interface niet gevonden in §4.9.1 van V51"
    toewijzing_body_v51 = toewijzing_match_v51.group(1)
    assert "'vrijstaand'" in toewijzing_body_v51
    assert "'gevel_op_de_dag'" in toewijzing_body_v51
    assert "'plafond_uitval'" in toewijzing_body_v51

    # 2. V55 architectuurtoetsing op master (en v55)
    outdoor_match = re.search(r'interface\s+OutdoorDimensionSpec\s*\{([^}]+)\}', master_content)
    assert outdoor_match, "OutdoorDimensionSpec interface niet gevonden in §4.9.1"
    outdoor_body = outdoor_match.group(1)
    assert "'lamellendak'" in outdoor_body
    assert "'glazen_schuifwand'" in outdoor_body
    assert "'terrasoverkapping'" in outdoor_body
    assert "montage:" in outdoor_body
    assert "bediening?:" in outdoor_body
    assert "'handmatig_schuiven'" in outdoor_body
    assert "motorzijde?:" in outdoor_body
    assert "terrasverwarming_watt" not in outdoor_body
    assert "led_geintegreerd" not in outdoor_body

    toewijzing_match = re.search(r'interface\s+ProductToewijzing\s*\{([^}]+)\}', master_content)
    assert toewijzing_match, "ProductToewijzing interface niet gevonden in §4.9.1"
    toewijzing_body = toewijzing_match.group(1)
    assert "montagewijze?:" not in toewijzing_body, "ProductToewijzing mag géén montagewijze meer bevatten (SSOT naar DimensionSpec)"


def test_v52_statusmodel_orthogonal_split(v52_content: str):
    """Toetst of V52 de zuivere splitsing Configuratiestatus en Montagestatus hanteert en maatstatus/ProductStatus saneert."""
    content = v52_content
    # Configuratiestatus
    cs_match = re.search(r"type\s+Configuratiestatus\s*=\s*'concept'\s*\|\s*'definitief'\s*\|\s*'geannuleerd';", content)
    assert cs_match, "Configuratiestatus type niet gevonden in §4.9.1"

    # Montagestatus
    ms_match = re.search(r"type\s+Montagestatus\s*=\s*'te_monteren'\s*\|\s*'geleverd'\s*\|\s*'gereed';", content)
    assert ms_match, "Montagestatus type niet gevonden in §4.9.1"

    # ProductToewijzing uses both
    pt_match = re.search(r'interface\s+ProductToewijzing\s*\{([^}]+)\}', content)
    assert pt_match, "ProductToewijzing interface niet gevonden in §4.9.1"
    pt_body = pt_match.group(1)
    assert "configuratiestatus: Configuratiestatus;" in pt_body
    assert "montagestatus: Montagestatus;" in pt_body
    assert "maatstatus" not in pt_body
    assert "product_status" not in pt_body

    # Check absence of legacy ProductStatus type in §4.9.1
    assert "type ProductStatus =" not in content


def test_v52_checklist_seven_levels(v52_content: str):
    """Toetst of checklisten op alle 7 niveaus configureerbaar zijn en 1NF relaties borgen (INV-CHK-01)."""
    content = v52_content
    cv_match = re.search(r'interface\s+ChecklistVraag\s*\{([^}]+)\}', content)
    assert cv_match, "ChecklistVraag interface niet gevonden in §4.9.1"
    cv_body = cv_match.group(1)
    assert "scope_niveau?:" in cv_body
    assert "'project' | 'object' | 'verdieping' | 'ruimte' | 'vlak' | 'positie' | 'product'" in cv_body

    # Niveau 7 1NF relaties
    ir_match = re.search(r'interface\s+InspectieResultaat\s*\{([^}]+)\}', content)
    assert ir_match, "InspectieResultaat interface niet gevonden in §4.9.1"
    assert "product_toewijzing_id?: string;" in ir_match.group(1)

    pt_match = re.search(r'interface\s+ProductToewijzing\s*\{([^}]+)\}', content)
    assert pt_match, "ProductToewijzing interface niet gevonden in §4.9.1"
    assert "inspectie_resultaten?: InspectieResultaat[];" in pt_match.group(1)


def test_v52_lt_ssot_and_diff_rapport(v52_content: str):
    """Toetst of LT-SSOT radicaal is vereenvoudigd met LTDiffRapport en deterministische convergentie (INV-LT-CONVERGE-01)."""
    content = v52_content
    # LTDiffRapport contracten
    assert "interface LTDiffRapport" in content
    assert "interface LTDiffRegel" in content
    assert "INV-LT-CONVERGE-01" in content

    # Sanering overengineering
    assert "LTPariteitAfwijking" not in content
    assert "ProjectLTReconciliatie" not in content
    assert "lt_bevestigd:*" not in content
    assert "lt_verwijdering_bevestigd:*" not in content
    assert "lt_qty_bevestigd:*" not in content
    assert "1-Klik Koppelhulp" not in content


def test_v52_hermeting_simplification(v52_content: str):
    """Toetst of hermeting in §5.2.7 vereenvoudigd is tot status-reversal naar concept."""
    content = v52_content
    assert "Hermeting Vlaggen" in content
    assert "'concept'" in content
    assert "frozen_at" in content


def test_v52_matrix_actions_and_product_switch(v52_content: str):
    """Toetst ontkoppelen naar pos_project_algemeen, [×]/[+] en productwissel met behoud van Positie dagmaten."""
    content = v52_content
    assert "pos_project_algemeen" in content
    assert "[×]" in content or "[x]" in content.lower()
    assert "[+]" in content
    assert "Productwissel" in content


def test_v52_lt_parity_scope(v52_content: str):
    """Toetst of de LT-pariteitscheck in §1.3 en §1.5.5 strikt is afgebakend tot ERP-relevante velden."""
    content = v52_content
    assert "daadwerkelijk in LogicTrade worden geadministreerd" in content or "daadwerkelijk in LogicTrade geadministreerd" in content


def test_v53_binary_configuratiestatus(v53_content: str, v54_content: str, master_content: str):
    """Toetst of V53 een zuiver binaire Configuratiestatus ('concept' | 'definitief') heeft."""
    for content in (v53_content, v54_content, master_content):
        cs_match = re.search(r"type\s+Configuratiestatus\s*=\s*'concept'\s*\|\s*'definitief';", content)
        assert cs_match, "Binaire Configuratiestatus ('concept' | 'definitief') niet gevonden in §4.9.1"
        assert "'geannuleerd'" not in cs_match.group(0), "'geannuleerd' mag niet in Configuratiestatus voorkomen"


def test_v53_first_class_annulering(v53_content: str, v54_content: str, master_content: str):
    """Toetst of V53 first-class AnnuleringInfo heeft en ProductToewijzing dit modelleert."""
    for content in (v53_content, v54_content, master_content):
        # AnnuleringInfo interface
        ai_match = re.search(r'interface\s+AnnuleringInfo\s*\{([^}]+)\}', content)
        assert ai_match, "AnnuleringInfo interface niet gevonden in §4.9.1"
        ai_body = ai_match.group(1)
        assert "geannuleerd_at:" in ai_body
        assert "geannuleerd_door_user_id:" in ai_body
        assert "reden:" in ai_body
        assert "'klant_geannuleerd'" in ai_body
        assert "'bouwkundig_onuitvoerbaar'" in ai_body
        assert "'productwissel'" in ai_body
        assert "'erp_reductie'" in ai_body

        # ProductToewijzing annulering veld
        pt_match = re.search(r'interface\s+ProductToewijzing\s*\{([^}]+)\}', content)
        assert pt_match, "ProductToewijzing interface niet gevonden in §4.9.1"
        pt_body = pt_match.group(1)
        assert "annulering: AnnuleringInfo | null;" in pt_body
        assert "frozen_at?: string;" in pt_body


def test_v53_checklist_action_triggers(v53_content: str, v54_content: str, master_content: str):
    """Toetst of V53 SSOT ChecklistTriggerActieType heeft en actietriggers ondersteunt in §4.9.1."""
    for content in (v53_content, v54_content, master_content):
        # ChecklistTriggerActieType
        cta_match = re.search(r'type\s+ChecklistTriggerActieType\s*=\s*([^;]+);', content)
        assert cta_match, "ChecklistTriggerActieType type niet gevonden in §4.9.1"
        cta_body = cta_match.group(1)
        for actie in ('blokkeer_definitief', 'maak_openstaande_actie', 'voeg_dienst_toe', 'reserveer_materieel', 'verplicht_foto', 'vereis_disclaimer_akkoord'):
            assert f"'{actie}'" in cta_body, f"Actie {actie} ontbreekt in ChecklistTriggerActieType"

        # ChecklistVraag trigger_actie_type
        cv_match = re.search(r'interface\s+ChecklistVraag\s*\{([^}]+)\}', content)
        assert cv_match, "ChecklistVraag interface niet gevonden in §4.9.1"
        assert "trigger_actie_type?: ChecklistTriggerActieType | 'geen';" in cv_match.group(1)

        # InspectieResultaat getriggerde_actie
        ir_match = re.search(r'interface\s+InspectieResultaat\s*\{([^}]+)\}', content)
        assert ir_match, "InspectieResultaat interface niet gevonden in §4.9.1"
        assert "getriggerde_actie?:" in ir_match.group(1)
        assert "type: ChecklistTriggerActieType;" in ir_match.group(1)


def test_v54_medallion_architecture(v54_content: str, master_content: str):
    """Toetst of de 3 lagen (Brons, Zilver, Goud) en bijbehorende architectuurtermen expliciet zijn gedefinieerd in §1.3 en §4.9.1."""
    for content in (v54_content, master_content):
        # 1. Medallion terminologie in §1.3
        assert "Brons (Ruwe Grondwaarheid" in content or "BRONS: Ruwe Grondwaarheid" in content
        assert "Zilver (Genormaliseerd Domeinmodel" in content or "ZILVER: Genormaliseerd Domeinmodel" in content
        assert "Goud (Werkmatrix & Buitendienst" in content or "GOUD: Werkmatrix & Buitendienst" in content
        assert "Multi-Lane Continue Delta-Synchronisatie" in content or "Multi-lane" in content
        assert "ConfigurationExtractionEngine" in content
        assert "p_preserve_silver = true" in content or "preserve_silver" in content
        assert "INV-RAW-IMMUTABILITY-01" in content

        # 2. Interfaces in §4.9.1
        assert "interface LogicTradeRawPayload" in content
        assert "interface LogicTradeProduct" in content
        assert "interface LogicTradeSyncLease" in content
        assert "interface NormalizedDimensionSpec" in content
        assert "interface NormalizedOrderLine" in content
        assert "interface ProductToewijzingLTContext" in content
        assert "interface ProductToewijzing" in content


def test_v54_article_database_and_container_fallback(v54_content: str, master_content: str):
    """Toetst dat de achterhaalde catalogustekst is gesaneerd en de actuele GSW-scope met fallback 9.9 is verankerd."""
    for content in (v54_content, master_content):
        # 1. Sanering verouderde 20.000 van 100.000 tekst
        assert "20.000 van" not in content

        # 2. GSW artikelen en containers
        assert "753" in content
        assert "58 generieke container" in content or "58 container" in content or "is_generic_container" in content

        # 3. Fallback 9.9
        assert "9.9 Niet geclassificeerd" in content or "9.9" in content


def test_v54_sanation_of_erp_export_and_lingering_statuses(v54_content: str, master_content: str):
    """Toetst dat alle 9 historische statusrestjes en de 'Post naar ERP' phrases zijn geëlimineerd."""
    for content in (v54_content, master_content):
        # 1. Geen status === 'geannuleerd' of status !== 'geannuleerd'
        assert "status === 'geannuleerd'" not in content
        assert "status !== 'geannuleerd'" not in content

        # 2. Geen 'draft' of status === 'draft'
        assert "status === 'draft'" not in content
        assert "Draft-Status" not in content
        assert "gekozen draft-product" not in content

        # 3. Geen status 'definitief' | 'geleverd' | 'gereed'
        assert "status 'definitief' | 'geleverd' | 'gereed'" not in content

        # 4. Geen Draft status-icoon of 'concept' / 'draft'
        assert "**Draft** status-icoon" not in content
        assert "naar 'concept' / 'draft'" not in content

        # 5. Geen op Configuratiestatus = 'geannuleerd'
        assert "op Configuratiestatus = 'geannuleerd'" not in content

        # 6. Geen Post naar ERP in Diensten matrix
        assert "Post naar ERP" not in content
        assert "Post sloop_vloer_m2 naar ERP-offerte" not in content
        assert "Post regie-uren naar ERP" not in content


def test_v55_two_axis_mounting_model(v55_content: str, master_content: str):
    """Toetst de integrale implementatie van het V55 2-Assen Montage- en Plaatsingsmodel over beide documenten."""
    for content in (v55_content, master_content):
        # 1. Specificatieversie header
        assert "> **Specificatieversie:** 55.0.0 (V55 2-Assen Montage- & Plaatsingsarchitectuur)" in content

        # 2. TypeScript Types in §4.9.1
        assert "type CurtainPlaatsingType = 'in_de_dag' | 'op_de_dag' | 'in_het_plafond';" in content
        assert "type BlindPlaatsingType =" in content
        for pt in ('op_het_glas', 'in_de_glaslat', 'op_de_glaslat', 'op_de_vleugel', 'op_het_kozijn', 'in_het_kozijn', 'in_de_dag', 'op_de_dag', 'in_het_plafond'):
            assert f"'{pt}'" in content

        assert "type OutdoorPlaatsingType = 'in_de_dag' | 'gevel_op_de_dag' | 'plafond_uitval' | 'vrijstaand';" in content
        assert "type BevestigingsMethode = 'schroeven' | 'klemmen' | 'plakken' | 'magnetisch' | 'boren_chemisch_anker';" in content
        assert "type BlindSteunType = 'wandsteun' | 'plafondsteun' | 'zijsteun' | 'spansysteem_klem' | 'spansysteem_plak' | 'profiel_klem' | 'profiel_plak' | 'inzetveer' | 'magneetstrip';" in content
        assert "type OutdoorSteunType = 'gevelsteun' | 'plafondsteun' | 'vrijstaand_voet' | 'zijgeleider_profiel' | 'zijgeleider_gevel';" in content

        # Compile-time discriminated unions
        assert "type SteunSpecificatie =" in content
        assert "| { steun_type: 'wandsteun'; wandsteun_uitval_mm: number }" in content
        assert "| { steun_type: Exclude<MontageVlakSteunType, 'wandsteun'>; wandsteun_uitval_mm?: never };" in content

        assert "interface CurtainMontageConfiguratie" in content
        assert "interface BlindMontageConfiguratie" in content
        assert "interface OutdoorMontageConfiguratie" in content
        assert "bestaande_rail_behouden?: boolean;" in content
        assert "heeft_afstandsbussen_staal?: boolean;" in content

        # 3. ProductToewijzing en DimensionSpecs
        toewijzing_match = re.search(r'interface\s+ProductToewijzing\s*\{([^}]+)\}', content)
        assert toewijzing_match
        assert "montagewijze?:" not in toewijzing_match.group(1)

        curtain_match = re.search(r'interface\s+CurtainDimensionSpec\s*\{([^}]+)\}', content)
        assert curtain_match
        assert "montage?: CurtainMontageConfiguratie;" in curtain_match.group(1)

        blind_match = re.search(r'interface\s+BlindDimensionSpec\s*\{([^}]+)\}', content)
        assert blind_match
        assert "montage: BlindMontageConfiguratie;" in blind_match.group(1)

        outdoor_match = re.search(r'interface\s+OutdoorDimensionSpec\s*\{([^}]+)\}', content)
        assert outdoor_match
        assert "montage: OutdoorMontageConfiguratie;" in outdoor_match.group(1)

        floor_match = re.search(r'interface\s+FloorDimensionSpec\s*\{([^}]+)\}', content)
        assert floor_match
        assert "legmethode?: 'verlijmd' | 'zwevend' | 'gespannen';" in floor_match.group(1)
        assert "montagewijze?:" not in floor_match.group(1)

        # 4. AuditVeldMutatie en LTDiffRegel pad-contract
        assert "type MontageVeldPad =" in content
        assert "veld_naam: string | MontageVeldPad;" in content

        # 5. Ketensanering teksten
        assert "14 montagewijzen" not in content
        assert "drie primaire montagesituaties" not in content
        assert "checkbox 'Tegen het plafond'" not in content
        assert "Plafond van de negge" not in content
        assert "35 mm" in content
        assert "18 mm" in content
        assert "15 mm" in content


# [SPEC-CHANGE-AUTHORIZED: V55 integrale verankering en terminologiereconciliatie]
def test_v55_integral_tables_and_terminology_reconciliation(v55_content: str, master_content: str):
    """Toetst de integrale mastertabellen in §3.1.1 en de ketenbrede uitbanning van alle phantom termen en expressies."""
    for content in (v55_content, master_content):
        # 1. Master Tabellen aanwezig in §3.1.1
        assert "#### Master Tabel 1: As 1 — Fysieke Plaatsing (`PlaatsingType`)" in content
        assert "#### Master Tabel 2: As 2 — Montagevlak, Steuntype & Bevestigingsmethode (`MontageConfiguratie`)" in content

        # Alle 12 plaatsingssituaties in Tabel 1
        for plaatsing in (
            "op_het_glas", "in_de_glaslat", "op_de_glaslat", "op_de_vleugel",
            "op_het_kozijn", "in_het_kozijn", "in_de_dag", "op_de_dag",
            "in_het_plafond", "gevel_op_de_dag", "plafond_uitval", "vrijstaand"
        ):
            assert f"`{plaatsing}`" in content

        # Alle 13 canonieke steuntypen in Tabel 2
        for steun in (
            "plafondsteun", "wandsteun", "zijsteun", "spansysteem_klem",
            "spansysteem_plak", "profiel_klem", "profiel_plak", "inzetveer",
            "magneetstrip", "gevelsteun", "vrijstaand_voet", "zijgeleider_profiel",
            "zijgeleider_gevel"
        ):
            assert f"`{steun}`" in content

        # 2. Documentbrede uitbanning van verouderde typenamen en phantom strings
        forbidden_terms = (
            "CurtainSteunType",
            "CurtainBevestigingsMethode",
            "BlindBevestigingsMethode",
            "OutdoorBevestigingsMethode",
            "chemisch_anker_m12",
            "plafondconsole_buiten",
            "gevelschroef_plug",
            "glaslatsteun",
            "plakprofiel",
            "klembeugel_vleugel",
            "magneetframe",
            "klemveer",
            "zijsteun_spanschroef",
            "kader_geleiderprofiel",
            "montage_scope",
            "montage.steun.type",
        )
        for term in forbidden_terms:
            assert term not in content, f"Fantoom-term '{term}' mag niet voorkomen in document."

        # Fantoom enum-waarde 'plafondclip' mag nergens in code of condities voorkomen
        assert "'plafondclip'" not in content, "Fantoom-waarde 'plafondclip' mag niet als enum voorkomen."

        # 3. Ketenbrede sanitatie verificatie in specifieke deelsecties
        # §1.3 SSOT
        assert "(SSOT in dimension_spec.montage)" in content
        # §3.2.6 Check 2 & 9
        assert "bestaande_rail_behouden = true" in content
        # §3.3.2 TruFit formulering
        assert "TruFit (profiel-plaksystemen direct op het glas" in content
        # §3.3.11 Check 25 & 26
        assert "montage.steun.steun_type = 'wandsteun'" in content
        assert "montage.steun.steun_type = 'plafondsteun'" in content


