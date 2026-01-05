"""
Deck pricing calculator for Kolmo Construction.
Generates detailed line-item quotes from structural models.
"""

from dataclasses import dataclass, field
from domain.models import DeckStructure, DeckingType, RailingType


# Material prices (per linear foot unless noted)
MATERIAL_PRICES: dict[str, float] = {
    # Framing lumber (pressure treated)
    "2x6_pt_lf": 1.25,
    "2x8_pt_lf": 1.55,
    "2x10_pt_lf": 1.85,
    "2x12_pt_lf": 2.40,
    "4x4_pt_lf": 2.10,
    "4x6_pt_lf": 3.20,
    "6x6_pt_lf": 4.80,
    
    # Decking (per linear foot)
    "trex_transcend_lf": 4.50,
    "trex_select_lf": 3.80,
    "timbertech_azek_lf": 5.20,
    "timbertech_pro_lf": 4.00,
    "cedar_decking_lf": 3.40,
    "pt_decking_lf": 1.80,
    
    # Hardware (each)
    "concrete_60lb_bag": 6.50,
    "joist_hanger": 3.50,
    "joist_hanger_lus210": 4.25,
    "post_base_pb44": 18.00,
    "post_base_pb66": 28.00,
    "post_cap_bc4": 12.00,
    "post_cap_bc6": 18.00,
    "ledger_bolt_half_inch": 1.20,
    "lag_screw_half_inch": 0.85,
    "carriage_bolt_half_inch": 1.40,
    "deck_screws_lb": 8.50,
    "structural_screws_box": 45.00,
    
    # Railing (per linear foot)
    "cable_rail_lf": 45.00,
    "glass_rail_lf": 120.00,
    "aluminum_rail_lf": 55.00,
    "wood_rail_cedar_lf": 25.00,
    "wood_rail_pt_lf": 18.00,
    
    # Stairs
    "stair_stringer_each": 35.00,
    "stair_tread_composite_each": 28.00,
    "stair_tread_cedar_each": 18.00,
}

# Labor rates
LABOR_RATES: dict[str, float] = {
    "footing_each": 175.00,           # Dig, form, pour, strip
    "framing_sqft": 14.00,            # Joists, beams, ledger, rim
    "decking_composite_sqft": 9.00,   # Composite install
    "decking_wood_sqft": 7.00,        # Wood install
    "railing_lf": 35.00,              # Any type, includes posts
    "stairs_tread_each": 225.00,      # Per tread installed
    "permit_filing": 250.00,          # Admin time for permit prep/filing
    "cleanup_sqft": 0.50,             # Site cleanup
}

# Permit fees (Seattle)
PERMIT_FEES: dict[str, float] = {
    "sdci_base": 197.00,              # Base permit fee
    "sdci_per_1000_valuation": 14.50, # Per $1,000 of project value
    "plan_review_multiplier": 0.65,   # 65% of permit fee
}

# Business
WASTE_FACTOR = 1.10     # 10% waste on materials
MARGIN = 0.25           # 25% gross margin


@dataclass
class LineItem:
    """Single line item in quote"""
    category: str
    description: str
    quantity: float
    unit: str
    material_cost: float
    labor_cost: float
    
    @property
    def total(self) -> float:
        return self.material_cost + self.labor_cost


@dataclass
class Quote:
    """Complete quote with all line items"""
    line_items: list[LineItem] = field(default_factory=list)
    
    materials_subtotal: float = 0.0
    labor_subtotal: float = 0.0
    permit_fees: float = 0.0
    subtotal: float = 0.0
    margin_amount: float = 0.0
    total: float = 0.0
    
    # Metadata
    deck_sqft: float = 0.0
    price_per_sqft: float = 0.0


def _get_lumber_price(nominal: str) -> float:
    """Get price per LF for lumber size"""
    key = f"{nominal.lower()}_pt_lf"
    return MATERIAL_PRICES.get(key, 2.00)


def _get_decking_price(decking_type: DeckingType) -> float:
    """Get decking material price per LF"""
    mapping = {
        DeckingType.COMPOSITE_TREX: MATERIAL_PRICES["trex_transcend_lf"],
        DeckingType.COMPOSITE_TIMBERTECH: MATERIAL_PRICES["timbertech_azek_lf"],
        DeckingType.CEDAR: MATERIAL_PRICES["cedar_decking_lf"],
        DeckingType.PRESSURE_TREATED: MATERIAL_PRICES["pt_decking_lf"],
    }
    return mapping.get(decking_type, MATERIAL_PRICES["trex_transcend_lf"])


def _get_railing_price(railing_type: RailingType) -> float:
    """Get railing material price per LF"""
    mapping = {
        RailingType.CABLE: MATERIAL_PRICES["cable_rail_lf"],
        RailingType.GLASS: MATERIAL_PRICES["glass_rail_lf"],
        RailingType.ALUMINUM: MATERIAL_PRICES["aluminum_rail_lf"],
        RailingType.WOOD: MATERIAL_PRICES["wood_rail_cedar_lf"],
        RailingType.NONE: 0.0,
    }
    return mapping.get(railing_type, 0.0)


def calculate_quote(structure: DeckStructure) -> Quote:
    """
    Generate detailed quote from structural model.
    """
    quote = Quote()
    site = structure.input
    
    width = site.width_ft
    depth = site.depth_ft
    sqft = width * depth
    quote.deck_sqft = sqft
    
    # ===== FOOTINGS =====
    footing_count = len(structure.footings)
    bags_per_footing = 4  # ~4 bags for 18" deep x 12-16" diameter
    
    footing_materials = footing_count * bags_per_footing * MATERIAL_PRICES["concrete_60lb_bag"]
    footing_materials += footing_count * MATERIAL_PRICES["post_base_pb44"]  # Post bases
    footing_labor = footing_count * LABOR_RATES["footing_each"]
    
    quote.line_items.append(LineItem(
        category="Footings",
        description=f"{footing_count} concrete pier footings, {structure.footing_diameter_in}\" dia x {site.frost_depth_in}\" deep",
        quantity=footing_count,
        unit="each",
        material_cost=footing_materials * WASTE_FACTOR,
        labor_cost=footing_labor
    ))
    
    # ===== POSTS =====
    post_lf = sum(p.height_ft for p in structure.posts)
    post_price = _get_lumber_price(structure.post_size)
    post_materials = post_lf * post_price
    post_materials += len(structure.posts) * MATERIAL_PRICES["post_cap_bc4"]  # Post caps
    
    quote.line_items.append(LineItem(
        category="Posts",
        description=f"{len(structure.posts)} {structure.post_size} posts, {post_lf:.0f} LF total",
        quantity=len(structure.posts),
        unit="each",
        material_cost=post_materials * WASTE_FACTOR,
        labor_cost=0  # Included in framing
    ))
    
    # ===== BEAMS =====
    beam_lf = sum((b.x_end_ft - b.x_start_ft) * b.ply for b in structure.beams)
    beam_price = _get_lumber_price(structure.beam_size)
    beam_materials = beam_lf * beam_price
    
    beam_desc = f"{structure.beam_ply}-{structure.beam_size}"
    quote.line_items.append(LineItem(
        category="Beams",
        description=f"{beam_desc} beam, {beam_lf:.0f} LF",
        quantity=beam_lf,
        unit="LF",
        material_cost=beam_materials * WASTE_FACTOR,
        labor_cost=0  # Included in framing
    ))
    
    # ===== JOISTS =====
    joist_lf = sum((j.y_end_ft - j.y_start_ft) for j in structure.joists)
    joist_price = _get_lumber_price(structure.joist_size)
    joist_materials = joist_lf * joist_price
    joist_materials += len(structure.joists) * 2 * MATERIAL_PRICES["joist_hanger"]  # Both ends
    
    quote.line_items.append(LineItem(
        category="Joists",
        description=f"{len(structure.joists)} {structure.joist_size} joists at {structure.joist_spacing_in}\" O.C., {joist_lf:.0f} LF",
        quantity=joist_lf,
        unit="LF",
        material_cost=joist_materials * WASTE_FACTOR,
        labor_cost=0  # Part of framing labor below
    ))
    
    # ===== LEDGER & RIM =====
    ledger_lf = width if structure.ledger else 0
    rim_lf = (depth * 2) + width  # Two sides + outer
    framing_misc_lf = ledger_lf + rim_lf
    
    misc_materials = framing_misc_lf * joist_price
    misc_materials += (ledger_lf / 16) * 12 * MATERIAL_PRICES["ledger_bolt_half_inch"]  # Ledger bolts at 16" O.C. staggered
    
    quote.line_items.append(LineItem(
        category="Ledger & Rim",
        description=f"Ledger board and rim joists, {framing_misc_lf:.0f} LF",
        quantity=framing_misc_lf,
        unit="LF",
        material_cost=misc_materials * WASTE_FACTOR,
        labor_cost=0
    ))
    
    # ===== FRAMING LABOR (combined) =====
    framing_labor = sqft * LABOR_RATES["framing_sqft"]
    quote.line_items.append(LineItem(
        category="Framing Labor",
        description=f"Complete framing installation, {sqft:.0f} SF",
        quantity=sqft,
        unit="SF",
        material_cost=0,
        labor_cost=framing_labor
    ))
    
    # ===== DECKING =====
    decking_lf = (sqft / (5.5 / 12))  # 5.5" wide boards
    decking_price = _get_decking_price(site.decking_type)
    decking_materials = decking_lf * decking_price
    decking_materials += (sqft / 4) * MATERIAL_PRICES["deck_screws_lb"]  # ~1 lb per 4 SF
    
    is_composite = site.decking_type in [DeckingType.COMPOSITE_TREX, DeckingType.COMPOSITE_TIMBERTECH]
    decking_labor = sqft * (LABOR_RATES["decking_composite_sqft"] if is_composite else LABOR_RATES["decking_wood_sqft"])
    
    quote.line_items.append(LineItem(
        category="Decking",
        description=f"{site.decking_type.value} decking, {sqft:.0f} SF",
        quantity=sqft,
        unit="SF",
        material_cost=decking_materials * WASTE_FACTOR,
        labor_cost=decking_labor
    ))
    
    # ===== RAILING (if any) =====
    if site.railing_type != RailingType.NONE and site.railing_lf > 0:
        railing_price = _get_railing_price(site.railing_type)
        railing_materials = site.railing_lf * railing_price
        railing_labor = site.railing_lf * LABOR_RATES["railing_lf"]
        
        quote.line_items.append(LineItem(
            category="Railing",
            description=f"{site.railing_type.value} railing, {site.railing_lf:.0f} LF",
            quantity=site.railing_lf,
            unit="LF",
            material_cost=railing_materials * WASTE_FACTOR,
            labor_cost=railing_labor
        ))
    
    # ===== STAIRS (if any) =====
    if site.stair_count > 0:
        stringers = 3  # Standard 3 stringers
        stringer_materials = stringers * MATERIAL_PRICES["stair_stringer_each"] * 1.5  # Adjusted for length
        tread_materials = site.stair_count * MATERIAL_PRICES["stair_tread_composite_each"]
        stair_materials = stringer_materials + tread_materials
        stair_labor = site.stair_count * LABOR_RATES["stairs_tread_each"]
        
        quote.line_items.append(LineItem(
            category="Stairs",
            description=f"{site.stair_count}-tread staircase with 3 stringers",
            quantity=site.stair_count,
            unit="treads",
            material_cost=stair_materials * WASTE_FACTOR,
            labor_cost=stair_labor
        ))
    
    # ===== CLEANUP =====
    cleanup_labor = sqft * LABOR_RATES["cleanup_sqft"]
    quote.line_items.append(LineItem(
        category="Cleanup",
        description="Site cleanup and debris removal",
        quantity=sqft,
        unit="SF",
        material_cost=0,
        labor_cost=cleanup_labor
    ))
    
    # ===== PERMITS =====
    materials_subtotal = sum(li.material_cost for li in quote.line_items)
    labor_subtotal = sum(li.labor_cost for li in quote.line_items)
    project_value = materials_subtotal + labor_subtotal
    
    permit_fee = PERMIT_FEES["sdci_base"]
    permit_fee += (project_value / 1000) * PERMIT_FEES["sdci_per_1000_valuation"]
    plan_review = permit_fee * PERMIT_FEES["plan_review_multiplier"]
    total_permit = permit_fee + plan_review + LABOR_RATES["permit_filing"]
    
    quote.line_items.append(LineItem(
        category="Permits",
        description="SDCI permit fees + Kolmo permit preparation",
        quantity=1,
        unit="LS",
        material_cost=permit_fee + plan_review,
        labor_cost=LABOR_RATES["permit_filing"]
    ))
    
    # ===== TOTALS =====
    quote.materials_subtotal = sum(li.material_cost for li in quote.line_items)
    quote.labor_subtotal = sum(li.labor_cost for li in quote.line_items)
    quote.permit_fees = total_permit
    quote.subtotal = quote.materials_subtotal + quote.labor_subtotal
    quote.margin_amount = quote.subtotal * MARGIN / (1 - MARGIN)
    quote.total = quote.subtotal + quote.margin_amount
    quote.price_per_sqft = quote.total / sqft
    
    return quote
