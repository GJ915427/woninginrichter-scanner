"""
test_gate2_adversarial_remediation.py
Independent Adversarial Empirical Test Harness for Gate 2 Remediation.

Tests:
1. EN 13120 Child Safety: Floor clearance invariant (>= 1500mm), impossible geometry (H_blind > H_install),
   unknown installation height, cordless/motorized bypass.
2. Euler-Bernoulli Elastic Deflection: Tube 28mm boundary verification at L >= 1800mm (or 1650mm heavy),
   deflection limit violation delta > 3.0mm, AC-3 pruning verification.
3. 2D Discrete Step Matrix Engine: Exact match W=800 stays at 800 (bisect_left), non-positive dimension rejection (422),
   intermediate step-up, upper bound rejection.
4. Net Price Reconciliation: 711.59 + 30.73 = 742.32 (0.00 cent drift), verification of physical deliverable files
   (DELIVERABLE_R2.md and DELIVERABLE_R4.md).
"""

import math
import os
import re
import sys
import unittest
from decimal import Decimal, ROUND_HALF_EVEN, ROUND_HALF_UP

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
R2_PATH = os.path.join(PROJECT_ROOT, ".agents", "teamwork", "worker_cpq_m2", "DELIVERABLE_R2.md")
R4_PATH = os.path.join(PROJECT_ROOT, ".agents", "teamwork", "worker_blueprint_m4", "DELIVERABLE_R4.md")


# ==============================================================================
# 1. EN 13120 Child Safety Specification & Logic Implementation
# ==============================================================================

class ValidationError422(Exception):
    def __init__(self, code, message):
        super().__init__(f"[{code}] {message}")
        self.code = code
        self.message = message


def validate_child_safety_en13120(h_blind, h_install=None, mechanism="fixed_tensioner", custom_cord_drop=None):
    """
    EN 13120 Child Safety Specification (post-remediation).
    All dimensions in mm.
    """
    # 1. Dimension validity check
    if h_blind is None or h_blind <= 0:
        raise ValidationError422("NON_COMPLIANT_GEOMETRY", f"Invalid blind height: {h_blind} mm")
    if h_install is not None and h_install <= 0:
        raise ValidationError422("NON_COMPLIANT_GEOMETRY", f"Invalid installation height: {h_install} mm")

    # 2. Prerequisite impossible geometry check: Blind cannot exceed installation height
    if h_install is not None and h_blind > h_install:
        raise ValidationError422(
            "NON_COMPLIANT_GEOMETRY",
            f"Product height ({h_blind} mm) cannot exceed installation height ({h_install} mm) - blind would drag on floor"
        )

    # 3. Cordless / Motorized bypass (Safe by Design)
    mech_lower = mechanism.lower()
    if any(m in mech_lower for m in ["literise", "powerview", "smartcord", "motor", "cordless"]):
        return {
            "compliant": True,
            "operatingLength": 0,
            "floorClearance": h_install if h_install is not None else "N/A",
            "safetyDevice": "NONE_REQUIRED_INTRINSICALLY_SAFE",
            "mechanism": mechanism
        }

    # 4. Fixed Tensioner (Retaining device / Vast spansysteem)
    if "fixed" in mech_lower or "tensioner" in mech_lower or "retaining" in mech_lower:
        if h_install is not None:
            # Floor clearance MUST be >= 1500 mm: L_operating <= H_install - 1500 mm
            max_allowed = h_install - 1500
            if max_allowed < 200:  # Physically impossible or dangerously low cord loop
                raise ValidationError422(
                    "NON_COMPLIANT_GEOMETRY",
                    f"Installation height {h_install} mm leaves max cord drop {max_allowed} mm < 200 mm to maintain 1500 mm floor clearance. Cordless/motorized operation required."
                )
            operating_length = custom_cord_drop if custom_cord_drop is not None else max_allowed
            if operating_length > max_allowed:
                raise ValidationError422(
                    "NON_COMPLIANT_GEOMETRY",
                    f"Requested cord drop {operating_length} mm exceeds max allowed {max_allowed} mm for EN 13120 compliance."
                )
            floor_clearance = h_install - operating_length
            if floor_clearance < 1500:
                raise ValidationError422("CRITICAL_CHILD_SAFETY_BREACH", f"Floor clearance {floor_clearance} mm < 1500 mm!")
            return {
                "compliant": True,
                "operatingLength": operating_length,
                "floorClearance": floor_clearance,
                "safetyDevice": "FIXED_TENSIONER",
                "mechanism": mechanism
            }
        else:
            # H_install unknown: default max chain drop <= 1000 mm
            operating_length = min(1000, custom_cord_drop) if custom_cord_drop is not None else 1000
            return {
                "compliant": True,
                "operatingLength": operating_length,
                "floorClearance": "UNKNOWN",
                "safetyDevice": "FIXED_TENSIONER",
                "mechanism": mechanism
            }

    # 5. Breakaway device (Breekbaar kettingslot / Quick-release)
    elif "breakaway" in mech_lower or "breek" in mech_lower:
        if h_install is not None:
            # Floor clearance MUST be >= 600 mm: L_operating <= H_install - 600 mm
            max_allowed = h_install - 600
            if max_allowed < 100:
                raise ValidationError422(
                    "NON_COMPLIANT_GEOMETRY",
                    f"Installation height {h_install} mm leaves max cord drop {max_allowed} mm < 100 mm for breakaway. Cordless required."
                )
            operating_length = custom_cord_drop if custom_cord_drop is not None else max_allowed
            if operating_length > max_allowed:
                raise ValidationError422(
                    "NON_COMPLIANT_GEOMETRY",
                    f"Requested cord drop {operating_length} mm exceeds max allowed {max_allowed} mm."
                )
            floor_clearance = h_install - operating_length
            if floor_clearance < 600:
                raise ValidationError422("CRITICAL_CHILD_SAFETY_BREACH", f"Floor clearance {floor_clearance} mm < 600 mm!")
            return {
                "compliant": True,
                "operatingLength": operating_length,
                "floorClearance": floor_clearance,
                "safetyDevice": "BREAKAWAY",
                "mechanism": mechanism
            }
        else:
            # Unknown install height for breakaway
            if h_blind <= 2500:
                operating_length = min(1000, custom_cord_drop) if custom_cord_drop is not None else 1000
            else:
                operating_length = min(int(h_blind * 2 / 3), custom_cord_drop) if custom_cord_drop is not None else int(h_blind * 2 / 3)
            return {
                "compliant": True,
                "operatingLength": operating_length,
                "floorClearance": "UNKNOWN",
                "safetyDevice": "BREAKAWAY",
                "mechanism": mechanism
            }

    raise ValueError(f"Unknown mechanism: {mechanism}")


# ==============================================================================
# 2. Euler-Bernoulli Deflection & Tube Pruning Engine
# ==============================================================================

def calculate_tube_deflection(span_mm, fabric_height_mm=2500, fabric_gsm=350, tube_type="28mm", bottom_rail_kg_per_m=0.45):
    """
    Euler-Bernoulli simply supported beam deflection under uniform distributed load:
    delta = (5 * q * L^4) / (384 * E * I)
    
    Tube dimensions (Aluminum 6063-T6, E = 70,000 MPa, density = 2700 kg/m^3):
    - 28mm: D_o = 28 mm, t = 1.0 mm -> D_i = 26 mm
    - 38mm: D_o = 38 mm, t = 1.2 mm -> D_i = 35.6 mm
    - 50mm: D_o = 50 mm, t = 1.5 mm -> D_i = 47.0 mm
    Bottom rail default: 0.45 kg/m
    """
    E_mpa = 70000.0  # N/mm^2
    g = 9.80665      # m/s^2

    tubes = {
        "28mm": {"Do": 28.0, "Di": 26.0, "t": 1.0},
        "38mm": {"Do": 38.0, "Di": 35.6, "t": 1.2},
        "50mm": {"Do": 50.0, "Di": 47.0, "t": 1.5},
    }
    spec = tubes[tube_type]
    Do, Di = spec["Do"], spec["Di"]

    # Second moment of area I = pi/64 * (Do^4 - Di^4) in mm^4
    I = (math.pi / 64.0) * (Do**4 - Di**4)

    # Tube linear mass in kg/m: Area (m^2) * 2700 kg/m^3
    area_mm2 = (math.pi / 4.0) * (Do**2 - Di**2)
    m_tube = (area_mm2 * 1e-6) * 2700.0  # kg/m

    # Fabric linear mass: fabric_gsm (g/m^2) * (fabric_height_mm / 1000) / 1000 (kg/m)
    m_fabric = (fabric_gsm / 1000.0) * (fabric_height_mm / 1000.0)

    # Bottom rail linear mass
    m_bottom_rail = bottom_rail_kg_per_m  # kg/m

    m_total = m_tube + m_fabric + m_bottom_rail  # kg/m
    q = (m_total * g) / 1000.0  # N/mm distributed load

    L = float(span_mm)
    delta_mm = (5.0 * q * (L**4)) / (384.0 * E_mpa * I)
    allowable_limit = min(L / 600.0, 3.0)  # L/600 or max 3.0mm

    return {
        "span_mm": span_mm,
        "tube": tube_type,
        "I_mm4": I,
        "q_N_per_mm": q,
        "delta_mm": round(delta_mm, 2),
        "allowable_limit_mm": round(allowable_limit, 2),
        "compliant": delta_mm <= allowable_limit
    }


def prune_tubes_ac3(span_mm, fabric_height_mm=2500, fabric_gsm=350):
    """
    AC-3 Domain pruning: selects the smallest tube satisfying deflection.
    """
    for tube in ["28mm", "38mm", "50mm"]:
        res = calculate_tube_deflection(span_mm, fabric_height_mm, fabric_gsm, tube)
        if res["compliant"]:
            return tube, res
    return None, None


# ==============================================================================
# 3. 2D Discrete Step Matrix Price Engine
# ==============================================================================

class PriceMatrixEngine:
    WIDTH_STEPS = [600, 800, 1000, 1200, 1500, 1800, 2000, 2400, 3000]
    HEIGHT_STEPS = [600, 800, 1000, 1200, 1500, 1800, 2000, 2400, 3000]

    # Sample standard 9x9 price grid
    PRICES = [
        [150, 180, 210, 240, 280, 330, 380, 450, 550],
        [180, 220, 260, 300, 350, 410, 470, 560, 680],
        [210, 260, 310, 360, 420, 490, 560, 670, 810],
        [240, 300, 360, 420, 490, 570, 650, 780, 940],
        [280, 350, 420, 490, 580, 680, 780, 930, 1120],
        [330, 410, 490, 570, 680, 800, 920, 1100, 1320],
        [380, 470, 560, 650, 780, 920, 1060, 1270, 1520],
        [450, 560, 670, 780, 930, 1100, 1270, 1520, 1820],
        [550, 680, 810, 940, 1120, 1320, 1520, 1820, 2180],
    ]

    @classmethod
    def find_step_index(cls, value, steps, dim_name):
        if value is None or value <= 0:
            raise ValidationError422("INVALID_DIMENSION", f"{dim_name} must be strictly positive (> 0), got: {value}")
        if value > steps[-1]:
            raise ValidationError422("OUT_OF_BOUNDS", f"{dim_name} {value} mm exceeds max supported dimension {steps[-1]} mm")

        # bisect_left / exact ceiling logic
        import bisect
        idx = bisect.bisect_left(steps, value)
        return idx, steps[idx]

    @classmethod
    def lookup_price(cls, width_mm, height_mm):
        w_idx, w_step = cls.find_step_index(width_mm, cls.WIDTH_STEPS, "Width")
        h_idx, h_step = cls.find_step_index(height_mm, cls.HEIGHT_STEPS, "Height")
        price = cls.PRICES[w_idx][h_idx]
        return {
            "w_step": w_step,
            "h_step": h_step,
            "w_index": w_idx,
            "h_index": h_idx,
            "price": price
        }


# ==============================================================================
# 4. Unit Test Suite
# ==============================================================================

class TestChildSafetyEN13120(unittest.TestCase):
    """Adversarial stress-testing of EN 13120 child safety rules and invariants."""

    def test_impossible_geometry_rejected(self):
        """Pre-check: H_blind > H_install must raise 422 NON_COMPLIANT_GEOMETRY."""
        with self.assertRaises(ValidationError422) as ctx:
            validate_child_safety_en13120(h_blind=3000, h_install=1800, mechanism="fixed_tensioner")
        self.assertEqual(ctx.exception.code, "NON_COMPLIANT_GEOMETRY")

    def test_negative_and_zero_dimensions(self):
        """Negative or zero heights must be rejected."""
        with self.assertRaises(ValidationError422):
            validate_child_safety_en13120(h_blind=-100, h_install=2500)
        with self.assertRaises(ValidationError422):
            validate_child_safety_en13120(h_blind=0, h_install=2500)
        with self.assertRaises(ValidationError422):
            validate_child_safety_en13120(h_blind=1500, h_install=-2500)
        with self.assertRaises(ValidationError422):
            validate_child_safety_en13120(h_blind=1500, h_install=0)

    def test_fixed_tensioner_floor_clearance_clamp_elimination(self):
        """
        Verify elimination of artificial 200mm clamp.
        When H_install <= 1700mm, maxAllowed = H_install - 1500 < 200mm.
        Must REJECT manual cord operation with NON_COMPLIANT_GEOMETRY.
        """
        # H_install = 1600mm -> maxAllowed = 100mm < 200mm -> MUST REJECT!
        with self.assertRaises(ValidationError422) as ctx:
            validate_child_safety_en13120(h_blind=1400, h_install=1600, mechanism="fixed_tensioner")
        self.assertEqual(ctx.exception.code, "NON_COMPLIANT_GEOMETRY")

        # H_install = 1500mm -> maxAllowed = 0mm -> MUST REJECT!
        with self.assertRaises(ValidationError422) as ctx:
            validate_child_safety_en13120(h_blind=1400, h_install=1500, mechanism="fixed_tensioner")
        self.assertEqual(ctx.exception.code, "NON_COMPLIANT_GEOMETRY")

        # H_install = 1700mm -> maxAllowed = 200mm -> Exactly minimum permissible threshold
        res = validate_child_safety_en13120(h_blind=1400, h_install=1700, mechanism="fixed_tensioner")
        self.assertTrue(res["compliant"])
        self.assertEqual(res["operatingLength"], 200)
        self.assertEqual(res["floorClearance"], 1500)

    def test_breakaway_floor_clearance_clamp_elimination(self):
        """
        Breakaway: Floor clearance must be >= 600mm.
        When H_install = 700mm, maxAllowed = 700 - 600 = 100mm.
        If H_install < 700mm, maxAllowed < 100mm -> MUST REJECT!
        """
        with self.assertRaises(ValidationError422) as ctx:
            validate_child_safety_en13120(h_blind=600, h_install=650, mechanism="breakaway")
        self.assertEqual(ctx.exception.code, "NON_COMPLIANT_GEOMETRY")

        # H_install = 700mm -> maxAllowed = 100mm -> permissible
        res = validate_child_safety_en13120(h_blind=600, h_install=700, mechanism="breakaway")
        self.assertTrue(res["compliant"])
        self.assertEqual(res["operatingLength"], 100)
        self.assertEqual(res["floorClearance"], 600)

    def test_unknown_installation_height_rules(self):
        """Unknown install height (h_install=None): standard defaults."""
        # Fixed tensioner: max chain drop <= 1000mm
        res_fixed = validate_child_safety_en13120(h_blind=1800, h_install=None, mechanism="fixed_tensioner")
        self.assertTrue(res_fixed["compliant"])
        self.assertEqual(res_fixed["operatingLength"], 1000)

        # Breakaway <= 2500mm: max chain drop <= 1000mm
        res_break_short = validate_child_safety_en13120(h_blind=2000, h_install=None, mechanism="breakaway")
        self.assertTrue(res_break_short["compliant"])
        self.assertEqual(res_break_short["operatingLength"], 1000)

        # Breakaway > 2500mm: (2/3) * H_blind
        res_break_tall = validate_child_safety_en13120(h_blind=3000, h_install=None, mechanism="breakaway")
        self.assertTrue(res_break_tall["compliant"])
        self.assertEqual(res_break_tall["operatingLength"], 2000)

    def test_cordless_motorized_bypass(self):
        """Cordless / motorized mechanisms are inherently Safe by Design."""
        for mech in ["LiteRise", "PowerView", "SmartCord", "Motorized 24V"]:
            res = validate_child_safety_en13120(h_blind=1400, h_install=1500, mechanism=mech)
            self.assertTrue(res["compliant"])
            self.assertEqual(res["operatingLength"], 0)

    def test_adversarial_combinatorial_sweep(self):
        """
        Fuzzing & parameter sweep across 100+ parameter sets.
        INVARIANT: Under NO circumstances can floorClearance < 1500mm for a compliant manual fixed tensioner!
        """
        h_installs = [1000, 1400, 1500, 1600, 1699, 1700, 1800, 2200, 2600, 3000]
        h_blinds = [800, 1200, 1500, 1800, 2200, 2500, 3000]

        for hi in h_installs:
            for hb in h_blinds:
                # Fixed tensioner
                try:
                    res = validate_child_safety_en13120(h_blind=hb, h_install=hi, mechanism="fixed_tensioner")
                    if res["compliant"]:
                        # Property: Floor clearance MUST be >= 1500
                        self.assertGreaterEqual(res["floorClearance"], 1500,
                            f"VIOLATION: Floor clearance {res['floorClearance']} < 1500 for hi={hi}, hb={hb}")
                        # Property: H_blind must be <= H_install
                        self.assertLessEqual(hb, hi, f"VIOLATION: hb={hb} > hi={hi}")
                except ValidationError422:
                    # Legitimate rejection of impossible geometry or low install height
                    if hi < 1700 or hb > hi:
                        pass
                    else:
                        raise

                # Breakaway
                try:
                    res = validate_child_safety_en13120(h_blind=hb, h_install=hi, mechanism="breakaway")
                    if res["compliant"]:
                        self.assertGreaterEqual(res["floorClearance"], 600)
                        self.assertLessEqual(hb, hi)
                except ValidationError422:
                    if hi < 700 or hb > hi:
                        pass
                    else:
                        raise


class TestEulerBernoulliDeflection(unittest.TestCase):
    """Adversarial testing of elastic tube deflection and AC-3 domain pruning."""

    def test_tube28_deflection_at_1800_fails(self):
        """
        Span 1800mm with standard screen (350 gsm):
        - At benchmark height H=2500mm: delta = 3.84 mm > allowable limit min(1800/600, 3.0) = 3.0 mm.
        - At lower height H=2000mm: delta = 3.41 mm > 3.0 mm.
        Must FAIL compliance in all operational scenarios.
        """
        res_2500 = calculate_tube_deflection(span_mm=1800, fabric_height_mm=2500, fabric_gsm=350, tube_type="28mm")
        self.assertFalse(res_2500["compliant"])
        self.assertGreater(res_2500["delta_mm"], 3.0)
        self.assertEqual(res_2500["allowable_limit_mm"], 3.0)
        self.assertAlmostEqual(res_2500["delta_mm"], 3.84, delta=0.05)

        res_2000 = calculate_tube_deflection(span_mm=1800, fabric_height_mm=2000, fabric_gsm=350, tube_type="28mm")
        self.assertFalse(res_2000["compliant"])
        self.assertGreater(res_2000["delta_mm"], 3.0)

    def test_tube28_deflection_at_1650_heavy_blackout_fails(self):
        """
        Span 1650mm with heavy blackout (550 gsm):
        - At benchmark height H=2500mm: delta = 3.59 mm > allowable limit min(1650/600, 3.0) = 2.75 mm.
        - At lower height H=2000mm: delta = 3.11 mm > 2.75 mm.
        Must FAIL compliance in all operational scenarios.
        """
        res_2500 = calculate_tube_deflection(span_mm=1650, fabric_height_mm=2500, fabric_gsm=550, tube_type="28mm")
        self.assertFalse(res_2500["compliant"])
        self.assertGreater(res_2500["delta_mm"], 2.75)
        self.assertEqual(res_2500["allowable_limit_mm"], 2.75)
        self.assertAlmostEqual(res_2500["delta_mm"], 3.59, delta=0.05)

        res_2000 = calculate_tube_deflection(span_mm=1650, fabric_height_mm=2000, fabric_gsm=550, tube_type="28mm")
        self.assertFalse(res_2000["compliant"])
        self.assertGreater(res_2000["delta_mm"], 2.75)

    def test_tube28_deflection_at_3200_is_catastrophic(self):
        """
        At 3200mm, 28mm tube deflection is ~38.4mm (over 12x allowable limit).
        Confirms original threshold claim (3200mm) was physically absurd.
        """
        res = calculate_tube_deflection(span_mm=3200, fabric_height_mm=2000, fabric_gsm=350, tube_type="28mm")
        self.assertFalse(res["compliant"])
        self.assertGreater(res["delta_mm"], 30.0)

    def test_ac3_pruning_and_promotion(self):
        """AC-3 domain pruning: at 1800mm, tube 28mm is pruned, promoting to 38mm or 50mm."""
        selected_tube, details = prune_tubes_ac3(span_mm=1800, fabric_height_mm=2000, fabric_gsm=350)
        self.assertIn(selected_tube, ["38mm", "50mm"])
        self.assertNotEqual(selected_tube, "28mm")
        self.assertTrue(details["compliant"])

        # At span 1200mm, 28mm tube is compliant
        selected_1200, det_1200 = prune_tubes_ac3(span_mm=1200, fabric_height_mm=2000, fabric_gsm=350)
        self.assertEqual(selected_1200, "28mm")
        self.assertTrue(det_1200["compliant"])


class TestMatrixCeilingLookup(unittest.TestCase):
    """Adversarial testing of 2D Discrete Step Matrix Price Engine."""

    def test_exact_matches_stay_at_exact_step(self):
        """
        CRITICAL: Exact match W=800mm MUST stay at 800mm (index 1).
        Must NOT step up to 1000mm (bisect_left vs bisect_right).
        """
        res = PriceMatrixEngine.lookup_price(800, 800)
        self.assertEqual(res["w_step"], 800)
        self.assertEqual(res["h_step"], 800)
        self.assertEqual(res["w_index"], 1)
        self.assertEqual(res["h_index"], 1)

        res_600 = PriceMatrixEngine.lookup_price(600, 1000)
        self.assertEqual(res_600["w_step"], 600)
        self.assertEqual(res_600["w_index"], 0)
        self.assertEqual(res_600["h_step"], 1000)
        self.assertEqual(res_600["h_index"], 2)

    def test_intermediate_values_step_up_to_next_tier(self):
        """W=801mm steps up to 1000mm tier."""
        res = PriceMatrixEngine.lookup_price(801, 800)
        self.assertEqual(res["w_step"], 1000)
        self.assertEqual(res["w_index"], 2)

        res2 = PriceMatrixEngine.lookup_price(650, 1150)
        self.assertEqual(res2["w_step"], 800)
        self.assertEqual(res2["h_step"], 1200)

    def test_non_positive_dimensions_rejected(self):
        """W <= 0 or H <= 0 MUST be rejected with 422 Unprocessable Entity."""
        for bad_w in [0, -1, -500]:
            with self.assertRaises(ValidationError422) as ctx:
                PriceMatrixEngine.lookup_price(bad_w, 1000)
            self.assertEqual(ctx.exception.code, "INVALID_DIMENSION")

        for bad_h in [0, -1, -500]:
            with self.assertRaises(ValidationError422) as ctx:
                PriceMatrixEngine.lookup_price(1000, bad_h)
            self.assertEqual(ctx.exception.code, "INVALID_DIMENSION")

    def test_out_of_bounds_rejected(self):
        """Dimensions exceeding 3000mm matrix max must be rejected."""
        with self.assertRaises(ValidationError422) as ctx:
            PriceMatrixEngine.lookup_price(3001, 1000)
        self.assertEqual(ctx.exception.code, "OUT_OF_BOUNDS")

        with self.assertRaises(ValidationError422) as ctx:
            PriceMatrixEngine.lookup_price(1000, 3500)
        self.assertEqual(ctx.exception.code, "OUT_OF_BOUNDS")


class TestNetPriceReconciliation(unittest.TestCase):
    """Financial reconciliation and 0.00 cent drift verification."""

    def test_benchmark_financial_reconciliation(self):
        """
        Benchmark Article A00052469:
        Base Gross = 861.02, Surcharge Gross = 37.19 -> Total Gross = 898.21
        Total Net = 742.32
        Base Net = 711.59
        Subtractive Surcharge Net = Total Net - Base Net = 742.32 - 711.59 = 30.73
        0.00 Cent Drift: 711.59 + 30.73 == 742.32
        """
        gross_base = Decimal("861.02")
        gross_surcharge = Decimal("37.19")
        gross_total = gross_base + gross_surcharge
        self.assertEqual(gross_total, Decimal("898.21"))

        vat_rate = Decimal("1.21")
        total_net = (gross_total / vat_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        self.assertEqual(total_net, Decimal("742.32"))

        base_net = (gross_base / vat_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        self.assertEqual(base_net, Decimal("711.59"))

        # Subtractive allocation
        surcharge_net = total_net - base_net
        self.assertEqual(surcharge_net, Decimal("30.73"))

        # Sum of parts exactly matches total net
        reconciled_sum = base_net + surcharge_net
        self.assertEqual(reconciled_sum, total_net)
        self.assertEqual(reconciled_sum, Decimal("742.32"))

        # Additive independent rounding comparison (drift demo)
        independent_surcharge_net = (gross_surcharge / vat_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        self.assertEqual(independent_surcharge_net, Decimal("30.74"))
        drift = (base_net + independent_surcharge_net) - total_net
        self.assertEqual(drift, Decimal("0.01"))  # Confirms that 30.74 was the source of the 1-cent drift!


class TestPhysicalDeliverableFiles(unittest.TestCase):
    """Empirical inspection of the physical markdown files DELIVERABLE_R2.md and DELIVERABLE_R4.md."""

    def test_deliverable_r4_eliminated_30_74_drift(self):
        """DELIVERABLE_R4.md must NOT contain 30.74 or 30,74 and must contain 30.73 / 30,73."""
        self.assertTrue(os.path.exists(R4_PATH), f"Missing {R4_PATH}")
        with open(R4_PATH, "r", encoding="utf-8") as f:
            content = f.read()

        # Confirm 30.74 / 30,74 is completely gone
        self.assertNotIn("30.74", content, "Found 30.74 in DELIVERABLE_R4.md!")
        self.assertNotIn("30,74", content, "Found 30,74 in DELIVERABLE_R4.md!")

        # Confirm 30.73 / 30,73 is present
        self.assertTrue("30.73" in content or "30,73" in content, "Missing 30.73/30,73 in DELIVERABLE_R4.md!")

    def test_deliverable_r2_eliminated_clamp_and_fixed_deflection(self):
        """DELIVERABLE_R2.md must NOT contain Math.max(200, ...) and must specify 1800mm tube pruning."""
        self.assertTrue(os.path.exists(R2_PATH), f"Missing {R2_PATH}")
        with open(R2_PATH, "r", encoding="utf-8") as f:
            content = f.read()

        # Confirm Math.max(200, ...) is absent
        self.assertNotIn("Math.max(200,", content, "Found Math.max(200, ...) in DELIVERABLE_R2.md!")

        # Confirm 1800mm deflection pruning is mentioned
        self.assertTrue("1800" in content, "Missing 1800mm pruning specification in DELIVERABLE_R2.md!")


if __name__ == "__main__":
    unittest.main(verbosity=2)
