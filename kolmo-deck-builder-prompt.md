# Kolmo Deck Quote Builder - Development Prompt

## Context

You are building an internal tool for Kolmo Construction (kolmo.io), a Seattle-based residential remodeling company. This tool automates the generation of deck permit drawings and quotes after a site visit.

## Business Requirements

After a Kolmo sales rep completes a site visit with real measurements, they need to generate:
1. **Permit PDF** - Code-compliant drawings for SDCI (Seattle Dept of Construction & Inspections) per Tip 312
2. **Quote PDF** - Customer-facing proposal with pricing
3. **Material Takeoff** - CSV/JSON for purchasing and crew

Currently this takes 2-3 hours of manual drafting. Target: < 5 minutes.

## Tech Stack

- **Backend:** Python 3.12, FastAPI
- **PDF Generation:** ReportLab
- **Database:** PostgreSQL with SQLAlchemy (for persisting quotes/projects)
- **Frontend:** React/Next.js (separate phase, API-first for now)
- **Deployment:** Docker

## Project Structure

```
kolmo-deck-builder/
├── app/
│   ├── main.py                 # FastAPI entrypoint
│   ├── config.py               # Settings, env vars
│   ├── models/                 # SQLAlchemy models
│   │   └── project.py
│   └── routers/
│       └── quotes.py           # API endpoints
├── domain/
│   ├── __init__.py
│   ├── models.py               # Domain dataclasses
│   ├── code_engine.py          # Tip 312 structural logic
│   └── validators.py           # Input validation
├── services/
│   ├── __init__.py
│   ├── quote_builder.py        # Orchestrates quote generation
│   ├── pricing.py              # Cost calculations
│   ├── permit_pdf.py           # SDCI permit drawings
│   ├── quote_pdf.py            # Customer quote document
│   └── takeoff.py              # Material list generation
├── tests/
│   ├── test_code_engine.py
│   ├── test_pricing.py
│   └── test_permit_pdf.py
├── pyproject.toml
├── Dockerfile
└── docker-compose.yml
```

## Domain Models

Create these dataclasses in `domain/models.py`:

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class DeckingType(Enum):
    COMPOSITE_TREX = "trex"
    COMPOSITE_TIMBERTECH = "timbertech"
    CEDAR = "cedar"
    PRESSURE_TREATED = "pt_wood"


class RailingType(Enum):
    NONE = "none"
    WOOD = "wood"
    CABLE = "cable"
    GLASS = "glass"
    ALUMINUM = "aluminum"


class LedgerAttachment(Enum):
    DIRECT = "direct"              # Bolted to rim joist
    STANDOFF = "standoff"          # With spacers for drainage
    FREESTANDING = "freestanding"  # No ledger, beam on both ends


@dataclass(frozen=True)
class LumberSpec:
    """Lumber specification with actual dimensions"""
    nominal: str        # "2x10"
    width_in: float     # 1.5
    height_in: float    # 9.25
    
    @property
    def width_ft(self) -> float:
        return self.width_in / 12
    
    @property
    def height_ft(self) -> float:
        return self.height_in / 12


# Standard lumber lookup
LUMBER_SPECS = {
    "2x6": LumberSpec("2x6", 1.5, 5.5),
    "2x8": LumberSpec("2x8", 1.5, 7.25),
    "2x10": LumberSpec("2x10", 1.5, 9.25),
    "2x12": LumberSpec("2x12", 1.5, 11.25),
    "4x4": LumberSpec("4x4", 3.5, 3.5),
    "4x6": LumberSpec("4x6", 3.5, 5.5),
    "4x8": LumberSpec("4x8", 3.5, 7.25),
    "4x10": LumberSpec("4x10", 3.5, 9.25),
    "4x12": LumberSpec("4x12", 3.5, 11.25),
    "6x6": LumberSpec("6x6", 5.5, 5.5),
}


@dataclass
class SiteInput:
    """Input from site visit - real measurements"""
    # Dimensions (required)
    width_ft: float               # Parallel to house
    depth_ft: float               # Perpendicular to house
    height_ft: float              # Grade to top of decking
    
    # Site conditions
    ledger_attachment: LedgerAttachment = LedgerAttachment.DIRECT
    soil_bearing_psf: int = 1500  # Conservative default
    frost_depth_in: int = 18      # Seattle default
    slope_percent: float = 0.0
    
    # Customer selections
    decking_type: DeckingType = DeckingType.COMPOSITE_TREX
    railing_type: RailingType = RailingType.NONE
    railing_lf: float = 0.0       # Linear feet of railing
    stair_count: int = 0          # Number of stair treads
    
    # Project info
    customer_name: str = ""
    site_address: str = ""
    

@dataclass
class Footing:
    """Concrete pier footing"""
    x_ft: float
    y_ft: float
    diameter_in: int
    depth_in: int


@dataclass  
class Post:
    """Vertical support post"""
    x_ft: float
    y_ft: float
    height_ft: float
    lumber: LumberSpec


@dataclass
class Beam:
    """Horizontal beam supporting joists"""
    x_start_ft: float
    x_end_ft: float
    y_ft: float
    z_ft: float           # Bottom of beam elevation
    lumber: LumberSpec
    ply: int = 2          # 1 for solid, 2 for doubled


@dataclass
class Joist:
    """Floor joist"""
    x_ft: float
    y_start_ft: float
    y_end_ft: float
    z_ft: float           # Bottom of joist elevation
    lumber: LumberSpec


@dataclass
class DeckStructure:
    """Output of code engine - complete structural model"""
    input: SiteInput
    
    # Structural members
    footings: list[Footing] = field(default_factory=list)
    posts: list[Post] = field(default_factory=list)
    beams: list[Beam] = field(default_factory=list)
    joists: list[Joist] = field(default_factory=list)
    ledger: Optional[dict] = None
    rim_joists: list[dict] = field(default_factory=list)
    
    # Selected sizes (for easy reference)
    joist_size: str = ""
    joist_spacing_in: int = 16
    beam_size: str = ""
    beam_ply: int = 2
    post_size: str = ""
    footing_diameter_in: int = 12
    
    # Compliance status
    compliant: bool = True
    notes: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
```

---

## Code Engine (Tip 312 Logic)

Implement in `domain/code_engine.py`. This is the core structural logic per Seattle Tip 312.

### Seattle Tip 312 Span Tables

**Joist Spans (Douglas Fir-Larch #2 or SPF #2):**

| Joist Size | 12" O.C. | 16" O.C. | 24" O.C. |
|------------|----------|----------|----------|
| 2x6        | 10'-6"   | 9'-6"    | 8'-0"    |
| 2x8        | 13'-10"  | 12'-6"   | 10'-6"   |
| 2x10       | 17'-8"   | 16'-0"   | 13'-6"   |
| 2x12       | 21'-6"   | 19'-6"   | 16'-6"   |

**Beam Spans (supporting deck joists):**

For joists at 16" O.C.:

| Beam Size  | 6' Joist Span | 8' Joist Span | 10' Joist Span | 12' Joist Span |
|------------|---------------|---------------|----------------|----------------|
| 2-2x6      | 5'-6"         | 4'-6"         | 4'-0"          | 3'-6"          |
| 2-2x8      | 7'-0"         | 6'-0"         | 5'-6"          | 5'-0"          |
| 2-2x10     | 9'-0"         | 8'-0"         | 7'-0"          | 6'-6"          |
| 2-2x12     | 11'-0"        | 9'-6"         | 8'-6"          | 7'-6"          |
| 4x6        | 5'-6"         | 4'-6"         | 4'-0"          | 3'-6"          |
| 4x8        | 7'-0"         | 6'-0"         | 5'-6"          | 5'-0"          |
| 4x10       | 9'-0"         | 8'-0"         | 7'-0"          | 6'-6"          |
| 4x12       | 11'-0"        | 9'-6"         | 8'-6"          | 7'-6"          |

**Post Sizing:**

| Post Size | Max Deck Height |
|-----------|-----------------|
| 4x4       | 8'-0"           |
| 4x6       | 14'-0"          |
| 6x6       | 14'-0"+         |

**Other Rules:**

- **Cantilever:** Maximum 1/4 of back-span (joist span from ledger to beam)
- **Footing Diameter:** Minimum 12"
- **Footing Depth:** Minimum 18" (Seattle frost line)
- **Footing Area:** tributary_area × 55 psf ÷ soil_bearing_capacity
- **Joist Spacing:** 16" O.C. standard, 12" for diagonal decking, 24" for heavy-duty joists

### Code Engine Implementation

```python
# domain/code_engine.py
"""
Seattle Tip 312 Prescriptive Deck Code Engine

Converts site measurements into a code-compliant structural design.
Reference: https://www.seattle.gov/sdci/codes/common-code-questions/decks
"""

import math
from .models import (
    SiteInput, DeckStructure, LedgerAttachment,
    Footing, Post, Beam, Joist,
    LumberSpec, LUMBER_SPECS
)


# Joist span table: (nominal_size, spacing_in) -> max_span_ft
JOIST_SPANS: dict[tuple[str, int], float] = {
    ("2x6", 12): 10.5,
    ("2x6", 16): 9.5,
    ("2x6", 24): 8.0,
    ("2x8", 12): 13.83,
    ("2x8", 16): 12.5,
    ("2x8", 24): 10.5,
    ("2x10", 12): 17.67,
    ("2x10", 16): 16.0,
    ("2x10", 24): 13.5,
    ("2x12", 12): 21.5,
    ("2x12", 16): 19.5,
    ("2x12", 24): 16.5,
}

# Beam span table: (beam_config, joist_span_category) -> max_beam_span_ft
# joist_span_category is ceiling of joist span in 2' increments: "6", "8", "10", "12"
BEAM_SPANS: dict[tuple[str, str], float] = {
    ("2-2x6", "6"): 5.5,   ("2-2x6", "8"): 4.5,   ("2-2x6", "10"): 4.0,   ("2-2x6", "12"): 3.5,
    ("2-2x8", "6"): 7.0,   ("2-2x8", "8"): 6.0,   ("2-2x8", "10"): 5.5,   ("2-2x8", "12"): 5.0,
    ("2-2x10", "6"): 9.0,  ("2-2x10", "8"): 8.0,  ("2-2x10", "10"): 7.0,  ("2-2x10", "12"): 6.5,
    ("2-2x12", "6"): 11.0, ("2-2x12", "8"): 9.5,  ("2-2x12", "10"): 8.5,  ("2-2x12", "12"): 7.5,
    ("4x6", "6"): 5.5,     ("4x6", "8"): 4.5,     ("4x6", "10"): 4.0,     ("4x6", "12"): 3.5,
    ("4x8", "6"): 7.0,     ("4x8", "8"): 6.0,     ("4x8", "10"): 5.5,     ("4x8", "12"): 5.0,
    ("4x10", "6"): 9.0,    ("4x10", "8"): 8.0,    ("4x10", "10"): 7.0,    ("4x10", "12"): 6.5,
    ("4x12", "6"): 11.0,   ("4x12", "8"): 9.5,    ("4x12", "10"): 8.5,    ("4x12", "12"): 7.5,
}

# Post height limits
POST_HEIGHT_LIMITS: dict[str, float] = {
    "4x4": 8.0,
    "4x6": 14.0,
    "6x6": 20.0,  # Practical limit
}

# Design loads
DEAD_LOAD_PSF = 15.0   # Framing + decking
LIVE_LOAD_PSF = 40.0   # Residential deck
TOTAL_LOAD_PSF = DEAD_LOAD_PSF + LIVE_LOAD_PSF

# Cantilever limit
MAX_CANTILEVER_RATIO = 0.25


def _get_joist_span_category(joist_span_ft: float) -> str:
    """Round joist span up to nearest category for beam lookup"""
    if joist_span_ft <= 6:
        return "6"
    elif joist_span_ft <= 8:
        return "8"
    elif joist_span_ft <= 10:
        return "10"
    else:
        return "12"


def _select_joist_size(span_ft: float, spacing_in: int = 16) -> str:
    """Select minimum joist size for given span and spacing"""
    for size in ["2x6", "2x8", "2x10", "2x12"]:
        max_span = JOIST_SPANS.get((size, spacing_in), 0)
        if max_span >= span_ft:
            return size
    raise ValueError(
        f"Joist span {span_ft:.1f}' exceeds maximum for any size at {spacing_in}\" O.C. "
        f"(max is {JOIST_SPANS.get(('2x12', spacing_in), 0):.1f}')"
    )


def _select_beam_size(beam_span_ft: float, joist_span_ft: float) -> tuple[str, int]:
    """
    Select minimum beam size for given spans.
    Returns (lumber_size, ply_count).
    """
    joist_cat = _get_joist_span_category(joist_span_ft)
    
    # Try doubled beams first (more common in residential)
    for size in ["2x6", "2x8", "2x10", "2x12"]:
        config = f"2-{size}"
        max_span = BEAM_SPANS.get((config, joist_cat), 0)
        if max_span >= beam_span_ft:
            return size, 2
    
    raise ValueError(
        f"Beam span {beam_span_ft:.1f}' exceeds maximum for joist span category {joist_cat}'. "
        f"Consider adding intermediate posts."
    )


def _select_post_size(height_ft: float) -> str:
    """Select minimum post size for given height"""
    for size in ["4x4", "4x6", "6x6"]:
        if POST_HEIGHT_LIMITS[size] >= height_ft:
            return size
    return "6x6"  # Default to largest


def _calculate_footing_diameter(
    tributary_area_sqft: float,
    soil_bearing_psf: int
) -> int:
    """Calculate required footing diameter in inches (rounded up to standard sizes)"""
    required_area_sqft = (tributary_area_sqft * TOTAL_LOAD_PSF) / soil_bearing_psf
    required_area_sqin = required_area_sqft * 144
    
    # Diameter from area: A = π * r², so d = 2 * sqrt(A / π)
    required_diameter = 2 * math.sqrt(required_area_sqin / math.pi)
    
    # Round up to standard sizes: 12", 14", 16", 18", 20", 24"
    standard_sizes = [12, 14, 16, 18, 20, 24]
    for size in standard_sizes:
        if size >= required_diameter:
            return size
    
    return 24  # Maximum standard size


def generate_structure(site_input: SiteInput) -> DeckStructure:
    """
    Generate a code-compliant deck structure from site measurements.
    
    Coordinate system:
    - Origin (0, 0) at center of ledger (house wall)
    - +X runs along house (width direction)
    - +Y runs away from house (depth direction)
    - +Z is up from grade
    
    Returns DeckStructure with all members positioned and sized.
    """
    structure = DeckStructure(input=site_input)
    
    width = site_input.width_ft
    depth = site_input.depth_ft
    height = site_input.height_ft
    
    # Determine joist spacing (default 16" O.C.)
    joist_spacing_in = 16
    structure.joist_spacing_in = joist_spacing_in
    
    # Calculate cantilever (default 2', but validate)
    # For freestanding decks, no cantilever
    if site_input.ledger_attachment == LedgerAttachment.FREESTANDING:
        cantilever_ft = 0.0
        joist_span_ft = depth / 2  # Beam at center
        beam_count = 2
    else:
        # Standard ledger-attached: cantilever = min(2', depth/4)
        max_cantilever = depth * MAX_CANTILEVER_RATIO
        cantilever_ft = min(2.0, max_cantilever)
        joist_span_ft = depth - cantilever_ft
        beam_count = 1
    
    # Validate cantilever
    if cantilever_ft > depth * MAX_CANTILEVER_RATIO:
        structure.errors.append(
            f"Cantilever {cantilever_ft:.1f}' exceeds maximum {depth * MAX_CANTILEVER_RATIO:.1f}' "
            f"(25% of {depth:.1f}' depth)"
        )
        structure.compliant = False
        return structure
    
    # Select joist size
    try:
        joist_size = _select_joist_size(joist_span_ft, joist_spacing_in)
        structure.joist_size = joist_size
        structure.notes.append(f"Joists: {joist_size} at {joist_spacing_in}\" O.C. (span {joist_span_ft:.1f}')")
    except ValueError as e:
        structure.errors.append(str(e))
        structure.compliant = False
        return structure
    
    joist_lumber = LUMBER_SPECS[joist_size]
    
    # Calculate elevations
    decking_thickness_ft = 1.0 / 12  # ~1" composite decking
    joist_top_z = height - decking_thickness_ft
    joist_bottom_z = joist_top_z - joist_lumber.height_ft
    beam_top_z = joist_bottom_z
    
    # Determine post spacing (beam span) and beam size
    # Start with max 8' post spacing, adjust beam size
    target_beam_span = 8.0
    num_posts = max(2, math.ceil(width / target_beam_span) + 1)
    actual_beam_span = width / (num_posts - 1)
    
    try:
        beam_lumber_size, beam_ply = _select_beam_size(actual_beam_span, joist_span_ft)
        structure.beam_size = beam_lumber_size
        structure.beam_ply = beam_ply
        beam_config = f"{beam_ply}-{beam_lumber_size}"
        structure.notes.append(
            f"Beam: {beam_config} (span {actual_beam_span:.1f}', {num_posts} posts)"
        )
    except ValueError as e:
        structure.errors.append(str(e))
        structure.compliant = False
        return structure
    
    beam_lumber = LUMBER_SPECS[beam_lumber_size]
    beam_bottom_z = beam_top_z - beam_lumber.height_ft
    
    # Post height (grade to bottom of beam)
    post_height_ft = beam_bottom_z
    
    # Select post size
    post_size = _select_post_size(post_height_ft)
    structure.post_size = post_size
    post_lumber = LUMBER_SPECS[post_size]
    
    if post_height_ft > POST_HEIGHT_LIMITS.get(post_size, 8.0):
        structure.notes.append(f"Posts: {post_size} at {post_height_ft:.1f}' height (verify with engineer)")
    else:
        structure.notes.append(f"Posts: {post_size} at {post_height_ft:.1f}' height")
    
    # Calculate footing size
    tributary_area = actual_beam_span * joist_span_ft
    footing_diameter = _calculate_footing_diameter(tributary_area, site_input.soil_bearing_psf)
    structure.footing_diameter_in = footing_diameter
    structure.notes.append(
        f"Footings: {footing_diameter}\" diameter x {site_input.frost_depth_in}\" deep "
        f"(tributary area {tributary_area:.0f} SF)"
    )
    
    # Generate beam Y position(s)
    if site_input.ledger_attachment == LedgerAttachment.FREESTANDING:
        beam_y_positions = [depth / 3, 2 * depth / 3]
    else:
        beam_y_positions = [depth - cantilever_ft]
    
    # Generate footings and posts
    for beam_y in beam_y_positions:
        for i in range(num_posts):
            x = -(width / 2) + (i * actual_beam_span)
            
            structure.footings.append(Footing(
                x_ft=x,
                y_ft=beam_y,
                diameter_in=footing_diameter,
                depth_in=site_input.frost_depth_in
            ))
            
            structure.posts.append(Post(
                x_ft=x,
                y_ft=beam_y,
                height_ft=post_height_ft,
                lumber=post_lumber
            ))
    
    # Generate beams
    for beam_y in beam_y_positions:
        structure.beams.append(Beam(
            x_start_ft=-width / 2,
            x_end_ft=width / 2,
            y_ft=beam_y,
            z_ft=beam_bottom_z,
            lumber=beam_lumber,
            ply=beam_ply
        ))
    
    # Generate joists
    joist_spacing_ft = joist_spacing_in / 12
    num_joists = math.floor(width / joist_spacing_ft) + 1
    total_joist_width = (num_joists - 1) * joist_spacing_ft
    joist_start_x = -total_joist_width / 2
    
    for i in range(num_joists):
        x = joist_start_x + (i * joist_spacing_ft)
        
        structure.joists.append(Joist(
            x_ft=x,
            y_start_ft=0 if site_input.ledger_attachment != LedgerAttachment.FREESTANDING else 0,
            y_end_ft=depth,
            z_ft=joist_bottom_z,
            lumber=joist_lumber
        ))
    
    structure.notes.append(f"Joists: {num_joists} total")
    
    # Generate ledger (if attached)
    if site_input.ledger_attachment != LedgerAttachment.FREESTANDING:
        structure.ledger = {
            "x_start_ft": -width / 2,
            "x_end_ft": width / 2,
            "y_ft": 0,
            "z_ft": joist_bottom_z,
            "lumber": joist_lumber,
            "attachment": site_input.ledger_attachment.value
        }
    
    # Generate rim joists
    structure.rim_joists = [
        {
            "location": "left",
            "x_ft": -width / 2,
            "y_start_ft": 0,
            "y_end_ft": depth,
            "lumber": joist_lumber
        },
        {
            "location": "right", 
            "x_ft": width / 2,
            "y_start_ft": 0,
            "y_end_ft": depth,
            "lumber": joist_lumber
        },
        {
            "location": "outer",
            "x_start_ft": -width / 2,
            "x_end_ft": width / 2,
            "y_ft": depth,
            "lumber": joist_lumber
        }
    ]
    
    return structure
```

---

## Pricing Service

Implement in `services/pricing.py`.

### Pricing Constants

```python
# services/pricing.py
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
        stringer_materials = stringers * MATERIAL_PRICES["stair_stringer_each"]
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
```

---

## Permit PDF Generator

Implement in `services/permit_pdf.py` using ReportLab.

### Drawing Requirements

**Sheet 1: Framing Plan (Top View)**
- Deck perimeter outline
- All joists with spacing callout
- Beam location (dashed line - hidden below joists)
- Ledger board
- Rim joists on three sides
- Footing locations (circles with X)
- Overall dimensions (width and depth)
- Joist spacing dimension
- North arrow
- Scale notation
- Drawing title

**Sheet 2: Section View**
- Cut through deck perpendicular to house
- Grade line (dashed)
- Footing below grade
- Post on footing
- Beam on post
- Joists bearing on beam
- Decking on joists
- All vertical dimensions (height to grade, footing depth)
- Member size labels
- Connection callouts

**Sheet 3: Details (on same sheet or separate)**
- Ledger connection detail
- Post-to-beam connection detail
- Typical joist hanger detail

**Title Block (all sheets):**
- "RESIDENTIAL DECK"
- Project address
- "Per Seattle Tip 312 Prescriptive Standards"
- Scale
- Date
- Sheet X of Y
- Kolmo Construction contact info

### PDF Implementation

```python
# services/permit_pdf.py
"""
SDCI Permit PDF Generator

Generates code-compliant permit drawings per Seattle Tip 312.
Uses ReportLab for PDF generation.
"""

from reportlab.lib.pagesizes import ARCH_D, LETTER, landscape
from reportlab.lib.units import inch, ft
from reportlab.pdfgen import canvas
from reportlab.lib.colors import black, gray, lightgrey, white
from typing import Tuple
from pathlib import Path
from datetime import date

from domain.models import DeckStructure


# Drawing constants
PAGE_SIZE = landscape(ARCH_D)  # 36" x 24"
MARGIN = 0.75 * inch
TITLE_BLOCK_HEIGHT = 2.5 * inch
TITLE_BLOCK_WIDTH = 4.5 * inch

# Line weights
LINE_HEAVY = 1.5
LINE_MEDIUM = 1.0
LINE_LIGHT = 0.5
LINE_HAIRLINE = 0.25

# Scale: 1/2" = 1'-0" (0.5 inch per foot)
SCALE = 0.5 * inch


class PermitPDFGenerator:
    """Generates SDCI permit drawings from DeckStructure"""
    
    def __init__(self, structure: DeckStructure, output_path: str | Path):
        self.structure = structure
        self.config = structure.input
        self.output_path = Path(output_path)
        self.c: canvas.Canvas = None
        self.page_width, self.page_height = PAGE_SIZE
        self.sheet_number = 0
        self.total_sheets = 2
        
    def generate(self) -> Path:
        """Generate complete permit package and return path"""
        self.c = canvas.Canvas(str(self.output_path), pagesize=PAGE_SIZE)
        
        # Sheet 1: Framing Plan
        self._draw_framing_plan()
        self.c.showPage()
        
        # Sheet 2: Section and Details
        self._draw_section_and_details()
        
        self.c.save()
        return self.output_path
    
    def _to_scale(self, feet: float) -> float:
        """Convert feet to drawing units at current scale"""
        return feet * SCALE
    
    def _draw_title_block(self):
        """Draw standard title block in bottom-right corner"""
        c = self.c
        self.sheet_number += 1
        
        # Title block position
        tb_x = self.page_width - MARGIN - TITLE_BLOCK_WIDTH
        tb_y = MARGIN
        
        # Outer border
        c.setStrokeColor(black)
        c.setLineWidth(LINE_HEAVY)
        c.rect(tb_x, tb_y, TITLE_BLOCK_WIDTH, TITLE_BLOCK_HEIGHT)
        
        # Horizontal dividers
        c.setLineWidth(LINE_LIGHT)
        c.line(tb_x, tb_y + 0.5*inch, tb_x + TITLE_BLOCK_WIDTH, tb_y + 0.5*inch)
        c.line(tb_x, tb_y + 1.5*inch, tb_x + TITLE_BLOCK_WIDTH, tb_y + 1.5*inch)
        
        # Text
        c.setFont("Helvetica-Bold", 14)
        c.drawString(tb_x + 0.15*inch, tb_y + 2.1*inch, "RESIDENTIAL DECK")
        
        c.setFont("Helvetica", 10)
        c.drawString(tb_x + 0.15*inch, tb_y + 1.85*inch, "Seattle Tip 312 Prescriptive")
        
        c.setFont("Helvetica", 9)
        # Project info
        address_lines = self.config.site_address.split(",")
        y_pos = tb_y + 1.3*inch
        for line in address_lines[:2]:
            c.drawString(tb_x + 0.15*inch, y_pos, line.strip())
            y_pos -= 0.15*inch
        
        # Scale and date
        c.drawString(tb_x + 0.15*inch, tb_y + 0.85*inch, f"Scale: 1/2\" = 1'-0\"")
        c.drawString(tb_x + 2.5*inch, tb_y + 0.85*inch, f"Date: {date.today().strftime('%m/%d/%Y')}")
        
        # Sheet number
        c.setFont("Helvetica-Bold", 12)
        c.drawString(tb_x + 0.15*inch, tb_y + 0.2*inch, 
                    f"Sheet {self.sheet_number} of {self.total_sheets}")
        
        # Kolmo info
        c.setFont("Helvetica", 8)
        c.drawString(tb_x + 2.5*inch, tb_y + 0.35*inch, "Kolmo Construction")
        c.drawString(tb_x + 2.5*inch, tb_y + 0.2*inch, "(206) 410-5100")
    
    def _draw_border(self):
        """Draw sheet border"""
        c = self.c
        c.setStrokeColor(black)
        c.setLineWidth(LINE_HEAVY)
        c.rect(MARGIN, MARGIN, 
               self.page_width - 2*MARGIN, 
               self.page_height - 2*MARGIN)
    
    def _draw_framing_plan(self):
        """Sheet 1: Top-down framing plan"""
        c = self.c
        self._draw_border()
        self._draw_title_block()
        
        # Calculate drawing origin (center the deck in available space)
        draw_area_width = self.page_width - 2*MARGIN - TITLE_BLOCK_WIDTH - 1*inch
        draw_area_height = self.page_height - 2*MARGIN - 1*inch
        
        deck_draw_width = self._to_scale(self.config.width_ft)
        deck_draw_depth = self._to_scale(self.config.depth_ft)
        
        origin_x = MARGIN + 3*inch + deck_draw_width/2
        origin_y = MARGIN + 2*inch + deck_draw_depth/2
        
        # Drawing title
        c.setFont("Helvetica-Bold", 14)
        c.drawString(origin_x - deck_draw_width/2, 
                    origin_y + deck_draw_depth/2 + 0.5*inch,
                    "FRAMING PLAN")
        
        # Helper to convert model coords to drawing coords
        def to_draw(x_ft: float, y_ft: float) -> Tuple[float, float]:
            return (
                origin_x + self._to_scale(x_ft),
                origin_y + self._to_scale(y_ft)
            )
        
        width = self.config.width_ft
        depth = self.config.depth_ft
        
        # === DECK OUTLINE ===
        c.setStrokeColor(black)
        c.setLineWidth(LINE_HEAVY)
        
        # Perimeter
        x1, y1 = to_draw(-width/2, 0)
        x2, y2 = to_draw(width/2, depth)
        c.rect(x1, y1, x2-x1, y2-y1)
        
        # === LEDGER ===
        if self.structure.ledger:
            c.setLineWidth(LINE_MEDIUM)
            lx1, ly = to_draw(-width/2, 0)
            lx2, _ = to_draw(width/2, 0)
            c.line(lx1, ly, lx2, ly)
            
            # Label
            c.setFont("Helvetica", 8)
            c.drawString(lx2 + 0.1*inch, ly - 0.05*inch, 
                        f"LEDGER ({self.structure.joist_size})")
        
        # === JOISTS ===
        c.setLineWidth(LINE_LIGHT)
        for joist in self.structure.joists:
            jx, jy1 = to_draw(joist.x_ft, joist.y_start_ft)
            _, jy2 = to_draw(joist.x_ft, joist.y_end_ft)
            c.line(jx, jy1, jx, jy2)
        
        # Joist spacing callout (at midpoint)
        if len(self.structure.joists) >= 2:
            mid_idx = len(self.structure.joists) // 2
            jx1, jy = to_draw(self.structure.joists[mid_idx-1].x_ft, depth/2)
            jx2, _ = to_draw(self.structure.joists[mid_idx].x_ft, depth/2)
            
            c.setLineWidth(LINE_HAIRLINE)
            c.line(jx1, jy - 0.3*inch, jx1, jy + 0.3*inch)
            c.line(jx2, jy - 0.3*inch, jx2, jy + 0.3*inch)
            c.line(jx1, jy, jx2, jy)
            
            c.setFont("Helvetica", 7)
            c.drawCentredString((jx1+jx2)/2, jy + 0.15*inch, 
                               f"{self.structure.joist_spacing_in}\" O.C. TYP")
        
        # === BEAM (dashed - below joists) ===
        c.setLineWidth(LINE_MEDIUM)
        c.setDash(6, 3)
        for beam in self.structure.beams:
            bx1, by = to_draw(beam.x_start_ft, beam.y_ft)
            bx2, _ = to_draw(beam.x_end_ft, beam.y_ft)
            c.line(bx1, by, bx2, by)
            
            # Label
            c.setDash()
            c.setFont("Helvetica", 8)
            beam_label = f"BEAM ({self.structure.beam_ply}-{self.structure.beam_size})"
            c.drawString(bx2 + 0.1*inch, by - 0.05*inch, beam_label)
            c.setDash(6, 3)
        
        c.setDash()  # Reset
        
        # === FOOTINGS ===
        c.setLineWidth(LINE_MEDIUM)
        footing_radius = self._to_scale(self.structure.footing_diameter_in / 12 / 2)
        
        for footing in self.structure.footings:
            fx, fy = to_draw(footing.x_ft, footing.y_ft)
            c.circle(fx, fy, footing_radius)
            # X mark inside
            c.line(fx - footing_radius*0.5, fy - footing_radius*0.5,
                   fx + footing_radius*0.5, fy + footing_radius*0.5)
            c.line(fx - footing_radius*0.5, fy + footing_radius*0.5,
                   fx + footing_radius*0.5, fy - footing_radius*0.5)
        
        # === DIMENSIONS ===
        self._draw_dimension_horizontal(
            c, origin_x, origin_y,
            -width/2, width/2, -1.5,
            f"{width:.0f}'-0\""
        )
        
        self._draw_dimension_vertical(
            c, origin_x, origin_y,
            0, depth, width/2 + 1.5,
            f"{depth:.0f}'-0\""
        )
        
        # === NOTES ===
        notes_x = MARGIN + 0.5*inch
        notes_y = self.page_height - MARGIN - 1*inch
        
        c.setFont("Helvetica-Bold", 10)
        c.drawString(notes_x, notes_y, "FRAMING NOTES:")
        
        c.setFont("Helvetica", 9)
        notes = [
            f"1. Joists: {self.structure.joist_size} at {self.structure.joist_spacing_in}\" O.C.",
            f"2. Beam: {self.structure.beam_ply}-{self.structure.beam_size}",
            f"3. Posts: {self.structure.post_size}",
            f"4. Footings: {self.structure.footing_diameter_in}\" dia. x {self.config.frost_depth_in}\" deep",
            f"5. Ledger: {self.structure.joist_size}, attach per IRC Table R507.9.1.3",
            "6. All lumber to be pressure treated or naturally durable",
            "7. All hardware to be hot-dipped galvanized or stainless steel",
        ]
        
        for i, note in enumerate(notes):
            c.drawString(notes_x, notes_y - (i+1)*0.2*inch, note)
    
    def _draw_section_and_details(self):
        """Sheet 2: Cross section and connection details"""
        c = self.c
        self._draw_border()
        self._draw_title_block()
        
        # Section drawing origin
        section_origin_x = MARGIN + 4*inch
        section_origin_y = MARGIN + 4*inch
        
        # Drawing title
        c.setFont("Helvetica-Bold", 14)
        c.drawString(section_origin_x - 2*inch, 
                    section_origin_y + self._to_scale(self.config.height_ft) + 1.5*inch,
                    "TYPICAL SECTION")
        
        depth = self.config.depth_ft
        height = self.config.height_ft
        
        # Get structural info
        joist_lumber = self.structure.joists[0].lumber if self.structure.joists else None
        beam = self.structure.beams[0] if self.structure.beams else None
        post = self.structure.posts[0] if self.structure.posts else None
        footing = self.structure.footings[0] if self.structure.footings else None
        
        if not all([joist_lumber, beam, post, footing]):
            return
        
        # Calculate elevations
        decking_thick = 1.0/12
        joist_top = height - decking_thick
        joist_bottom = joist_top - joist_lumber.height_ft
        beam_top = joist_bottom
        beam_bottom = beam_top - beam.lumber.height_ft
        post_height = beam_bottom
        
        def to_draw(y_ft: float, z_ft: float) -> Tuple[float, float]:
            return (
                section_origin_x + self._to_scale(y_ft),
                section_origin_y + self._to_scale(z_ft)
            )
        
        # === GRADE LINE ===
        c.setLineWidth(LINE_LIGHT)
        c.setDash(8, 4)
        gx1, gy = to_draw(-2, 0)
        gx2, _ = to_draw(depth + 2, 0)
        c.line(gx1, gy, gx2, gy)
        c.setDash()
        
        c.setFont("Helvetica", 8)
        c.drawString(gx2 + 0.1*inch, gy, "GRADE")
        
        # === HOUSE WALL (left side) ===
        c.setLineWidth(LINE_HEAVY)
        c.setFillColor(lightgrey)
        wx, wy = to_draw(-0.5, 0)
        wall_width = 0.5 * inch
        wall_height = self._to_scale(height + 2)
        c.rect(wx - wall_width, wy, wall_width, wall_height, fill=1)
        c.setFillColor(white)
        
        c.setFont("Helvetica", 8)
        c.drawString(wx - wall_width - 0.5*inch, wy + wall_height/2, "HOUSE")
        
        # === FOOTING ===
        c.setLineWidth(LINE_MEDIUM)
        footing_width = self._to_scale(footing.diameter_in / 12)
        footing_depth = self._to_scale(footing.depth_in / 12)
        fx, fy = to_draw(beam.y_ft, -footing.depth_in/12)
        c.rect(fx - footing_width/2, fy, footing_width, footing_depth)
        
        c.setFont("Helvetica", 7)
        c.drawString(fx + footing_width/2 + 0.1*inch, fy + footing_depth/2,
                    f"{footing.diameter_in}\" DIA PIER")
        
        # === POST ===
        post_width = self._to_scale(post.lumber.width_ft)
        px, py = to_draw(beam.y_ft, 0)
        c.rect(px - post_width/2, py, post_width, self._to_scale(post_height))
        
        c.setFont("Helvetica", 7)
        c.drawString(px + post_width/2 + 0.1*inch, py + self._to_scale(post_height/2),
                    f"{self.structure.post_size} POST")
        
        # === BEAM ===
        beam_width = self._to_scale(beam.lumber.width_ft * beam.ply)
        beam_height_draw = self._to_scale(beam.lumber.height_ft)
        bx, by = to_draw(beam.y_ft, beam_bottom)
        c.rect(bx - beam_width/2, by, beam_width, beam_height_draw)
        
        # === JOISTS (profile view - single rectangle) ===
        joist_height_draw = self._to_scale(joist_lumber.height_ft)
        jx1, jy = to_draw(0, joist_bottom)
        jx2, _ = to_draw(depth, joist_bottom)
        c.rect(jx1, jy, jx2 - jx1, joist_height_draw)
        
        c.setFont("Helvetica", 7)
        c.drawString(jx1 + 0.2*inch, jy + joist_height_draw/2,
                    f"{self.structure.joist_size} JOISTS @ {self.structure.joist_spacing_in}\" O.C.")
        
        # === DECKING ===
        c.setLineWidth(LINE_HEAVY)
        dx1, dy = to_draw(0, joist_top)
        dx2, _ = to_draw(depth, joist_top)
        c.line(dx1, dy + self._to_scale(decking_thick), 
               dx2, dy + self._to_scale(decking_thick))
        
        # === DIMENSIONS ===
        # Height dimension
        self._draw_dimension_vertical(
            c, section_origin_x, section_origin_y,
            0, height, depth + 2,
            f"{height:.0f}'-0\""
        )
        
        # Footing depth
        c.setLineWidth(LINE_HAIRLINE)
        c.setFont("Helvetica", 7)
        fx1, fy1 = to_draw(beam.y_ft + 2, 0)
        _, fy2 = to_draw(beam.y_ft + 2, -footing.depth_in/12)
        c.line(fx1, fy1, fx1, fy2)
        c.line(fx1 - 0.1*inch, fy1, fx1 + 0.1*inch, fy1)
        c.line(fx1 - 0.1*inch, fy2, fx1 + 0.1*inch, fy2)
        c.drawString(fx1 + 0.15*inch, (fy1+fy2)/2, f"{footing.depth_in}\"")
        
        # === GENERAL NOTES ===
        notes_x = self.page_width - MARGIN - TITLE_BLOCK_WIDTH - 3.5*inch
        notes_y = self.page_height - MARGIN - 1*inch
        
        c.setFont("Helvetica-Bold", 10)
        c.drawString(notes_x, notes_y, "GENERAL NOTES:")
        
        c.setFont("Helvetica", 8)
        notes = [
            "1. Design per Seattle Tip 312 Prescriptive Standards",
            "2. All lumber: Pressure treated SPF #2 or DF-L #2 min.",
            "3. All hardware: Hot-dipped galvanized or stainless steel",
            "4. Ledger: 1/2\" lag screws at 16\" O.C., staggered",
            "5. Joist hangers: Simpson LUS210 or equivalent at ledger",
            "6. Post base: Simpson PBS44 or equivalent",
            "7. Post cap: Simpson BC4 or equivalent",
            "8. Beam-to-post: Through-bolt with 1/2\" carriage bolts",
            "9. Verify all dimensions in field before construction",
            "10. Obtain required inspections per SDCI",
        ]
        
        for i, note in enumerate(notes):
            c.drawString(notes_x, notes_y - (i+1)*0.18*inch, note)
    
    def _draw_dimension_horizontal(self, c, origin_x, origin_y, 
                                   x1_ft, x2_ft, y_ft, text):
        """Draw a horizontal dimension line"""
        c.setLineWidth(LINE_HAIRLINE)
        c.setStrokeColor(black)
        
        dx1 = origin_x + self._to_scale(x1_ft)
        dx2 = origin_x + self._to_scale(x2_ft)
        dy = origin_y + self._to_scale(y_ft)
        
        # Extension lines
        c.line(dx1, dy - 0.1*inch, dx1, dy + 0.1*inch)
        c.line(dx2, dy - 0.1*inch, dx2, dy + 0.1*inch)
        
        # Dimension line
        c.line(dx1, dy, dx2, dy)
        
        # Arrows (tick marks)
        c.line(dx1, dy - 0.08*inch, dx1, dy + 0.08*inch)
        c.line(dx2, dy - 0.08*inch, dx2, dy + 0.08*inch)
        
        # Text
        c.setFont("Helvetica", 9)
        c.drawCentredString((dx1 + dx2) / 2, dy - 0.25*inch, text)
    
    def _draw_dimension_vertical(self, c, origin_x, origin_y,
                                 z1_ft, z2_ft, y_ft, text):
        """Draw a vertical dimension line"""
        c.setLineWidth(LINE_HAIRLINE)
        c.setStrokeColor(black)
        
        dx = origin_x + self._to_scale(y_ft)
        dz1 = origin_y + self._to_scale(z1_ft)
        dz2 = origin_y + self._to_scale(z2_ft)
        
        # Extension lines
        c.line(dx - 0.1*inch, dz1, dx + 0.1*inch, dz1)
        c.line(dx - 0.1*inch, dz2, dx + 0.1*inch, dz2)
        
        # Dimension line
        c.line(dx, dz1, dx, dz2)
        
        # Text (rotated)
        c.saveState()
        c.translate(dx + 0.25*inch, (dz1 + dz2) / 2)
        c.rotate(90)
        c.setFont("Helvetica", 9)
        c.drawCentredString(0, 0, text)
        c.restoreState()


def generate_permit_pdf(structure: DeckStructure, output_path: str | Path) -> Path:
    """Convenience function to generate permit PDF"""
    generator = PermitPDFGenerator(structure, output_path)
    return generator.generate()
```

---

## Quote PDF Generator

Implement in `services/quote_pdf.py`. Customer-facing document.

```python
# services/quote_pdf.py
"""
Customer Quote PDF Generator
"""

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import black, HexColor
from pathlib import Path
from datetime import date, timedelta

from domain.models import DeckStructure
from services.pricing import Quote


KOLMO_BLUE = HexColor("#1e40af")


def generate_quote_pdf(
    structure: DeckStructure,
    quote: Quote,
    output_path: str | Path
) -> Path:
    """Generate customer-facing quote PDF"""
    
    output_path = Path(output_path)
    c = canvas.Canvas(str(output_path), pagesize=LETTER)
    width, height = LETTER
    
    config = structure.input
    
    # === HEADER ===
    c.setFillColor(KOLMO_BLUE)
    c.rect(0, height - 1.5*inch, width, 1.5*inch, fill=1)
    
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(0.75*inch, height - 1*inch, "KOLMO CONSTRUCTION")
    
    c.setFont("Helvetica", 11)
    c.drawString(0.75*inch, height - 1.25*inch, "Building the Future, Together")
    
    c.setFillColor(black)
    
    # === PROJECT INFO ===
    y = height - 2*inch
    
    c.setFont("Helvetica-Bold", 14)
    c.drawString(0.75*inch, y, "DECK PROJECT QUOTE")
    y -= 0.35*inch
    
    c.setFont("Helvetica", 11)
    c.drawString(0.75*inch, y, f"Prepared for: {config.customer_name}")
    y -= 0.2*inch
    c.drawString(0.75*inch, y, f"Project Address: {config.site_address}")
    y -= 0.2*inch
    c.drawString(0.75*inch, y, f"Date: {date.today().strftime('%B %d, %Y')}")
    y -= 0.2*inch
    valid_until = date.today() + timedelta(days=30)
    c.drawString(0.75*inch, y, f"Valid Until: {valid_until.strftime('%B %d, %Y')}")
    
    # === PROJECT SUMMARY ===
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(0.75*inch, y, "PROJECT SUMMARY")
    y -= 0.25*inch
    
    c.setFont("Helvetica", 10)
    summary = [
        f"Deck Size: {config.width_ft:.0f}' x {config.depth_ft:.0f}' ({quote.deck_sqft:.0f} SF)",
        f"Deck Height: {config.height_ft:.1f}' from grade",
        f"Decking Material: {config.decking_type.value.replace('_', ' ').title()}",
        f"Railing: {config.railing_type.value.title()}" + 
            (f" ({config.railing_lf:.0f} LF)" if config.railing_lf > 0 else ""),
        f"Stairs: {config.stair_count} treads" if config.stair_count > 0 else "Stairs: None",
    ]
    
    for line in summary:
        c.drawString(1*inch, y, f"• {line}")
        y -= 0.18*inch
    
    # === PRICING ===
    y -= 0.4*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(0.75*inch, y, "INVESTMENT")
    y -= 0.3*inch
    
    # Category totals (not line items)
    categories = {}
    for item in quote.line_items:
        cat = item.category
        if cat not in categories:
            categories[cat] = 0
        categories[cat] += item.total
    
    c.setFont("Helvetica", 10)
    for cat, total in categories.items():
        c.drawString(1*inch, y, cat)
        c.drawRightString(width - 1*inch, y, f"${total:,.0f}")
        y -= 0.18*inch
    
    # Subtotal and total
    y -= 0.15*inch
    c.setLineWidth(0.5)
    c.line(1*inch, y + 0.1*inch, width - 1*inch, y + 0.1*inch)
    
    y -= 0.05*inch
    c.setFont("Helvetica-Bold", 11)
    c.drawString(1*inch, y, "PROJECT TOTAL")
    c.drawRightString(width - 1*inch, y, f"${quote.total:,.0f}")
    
    y -= 0.25*inch
    c.setFont("Helvetica", 9)
    c.drawString(1*inch, y, f"(${quote.price_per_sqft:.2f} per square foot)")
    
    # === INCLUSIONS ===
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(0.75*inch, y, "WHAT'S INCLUDED")
    y -= 0.25*inch
    
    c.setFont("Helvetica", 9)
    inclusions = [
        "Complete design and permit drawings per Seattle Tip 312",
        "SDCI permit application and fees",
        "All materials, delivery, and waste removal",
        "Professional installation by licensed crew",
        "Final inspection coordination",
        "1-year workmanship warranty",
        "Manufacturer warranty on decking materials",
    ]
    
    for item in inclusions:
        c.drawString(1*inch, y, f"✓ {item}")
        y -= 0.16*inch
    
    # === TERMS ===
    y -= 0.3*inch
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.75*inch, y, "TERMS")
    y -= 0.2*inch
    
    c.setFont("Helvetica", 8)
    terms = [
        "• 50% deposit due upon contract signing",
        "• 50% balance due upon completion",
        "• Work to commence within 2-4 weeks of permit approval",
        "• Estimated project duration: 3-5 working days",
        "• Quote valid for 30 days from date above",
    ]
    
    for term in terms:
        c.drawString(0.75*inch, y, term)
        y -= 0.14*inch
    
    # === SIGNATURE ===
    y -= 0.4*inch
    c.setFont("Helvetica", 10)
    c.drawString(0.75*inch, y, "To proceed, please sign below:")
    y -= 0.5*inch
    
    c.line(0.75*inch, y, 3.5*inch, y)
    c.drawString(0.75*inch, y - 0.15*inch, "Customer Signature")
    c.drawString(0.75*inch, y - 0.3*inch, "Date: _____________")
    
    # === FOOTER ===
    c.setFont("Helvetica", 8)
    c.drawCentredString(width/2, 0.5*inch, 
                       "Kolmo Construction | (206) 410-5100 | kolmo.io | License #KOLMOCC123AB")
    
    c.save()
    return output_path
```

---

## Material Takeoff

Implement in `services/takeoff.py`:

```python
# services/takeoff.py
"""
Material takeoff/BOM generator
"""

import csv
from pathlib import Path
from dataclasses import dataclass
from domain.models import DeckStructure


@dataclass
class TakeoffItem:
    category: str
    item: str
    size: str
    quantity: float
    unit: str
    notes: str = ""


def generate_takeoff(structure: DeckStructure) -> list[TakeoffItem]:
    """Generate material takeoff from structure"""
    items = []
    config = structure.input
    
    # Footings
    for i, footing in enumerate(structure.footings):
        items.append(TakeoffItem(
            category="Concrete",
            item="Concrete Pier",
            size=f"{footing.diameter_in}\" x {footing.depth_in}\"",
            quantity=1,
            unit="each",
            notes=f"Location: ({footing.x_ft:.1f}', {footing.y_ft:.1f}')"
        ))
    
    bags_total = len(structure.footings) * 4
    items.append(TakeoffItem(
        category="Concrete",
        item="Concrete Mix (60 lb bag)",
        size="60 lb",
        quantity=bags_total,
        unit="bags",
        notes="~4 bags per footing"
    ))
    
    # Posts
    post_lengths = {}
    for post in structure.posts:
        length = round(post.height_ft + 0.5)  # Round up for cutting
        key = f"{structure.post_size} x {length}'"
        post_lengths[key] = post_lengths.get(key, 0) + 1
    
    for size_len, qty in post_lengths.items():
        items.append(TakeoffItem(
            category="Lumber - Posts",
            item="Post",
            size=size_len,
            quantity=qty,
            unit="each"
        ))
    
    # Post hardware
    items.append(TakeoffItem(
        category="Hardware",
        item="Post Base (Simpson PBS44)",
        size="4x4",
        quantity=len(structure.posts),
        unit="each"
    ))
    items.append(TakeoffItem(
        category="Hardware",
        item="Post Cap (Simpson BC4)",
        size="4x4",
        quantity=len(structure.posts),
        unit="each"
    ))
    
    # Beams
    for beam in structure.beams:
        length = beam.x_end_ft - beam.x_start_ft
        items.append(TakeoffItem(
            category="Lumber - Beams",
            item=f"Beam ({structure.beam_ply}-ply)",
            size=f"{structure.beam_size} x {length:.0f}'",
            quantity=structure.beam_ply,
            unit="pieces"
        ))
    
    # Joists
    joist_length = config.depth_ft
    items.append(TakeoffItem(
        category="Lumber - Joists",
        item="Joist",
        size=f"{structure.joist_size} x {joist_length:.0f}'",
        quantity=len(structure.joists),
        unit="pieces"
    ))
    
    # Joist hangers
    items.append(TakeoffItem(
        category="Hardware",
        item="Joist Hanger (Simpson LUS210)",
        size=f"2x{structure.joist_size.split('x')[1]}",
        quantity=len(structure.joists) * 2,
        unit="each",
        notes="Both ends of each joist"
    ))
    
    # Ledger
    if structure.ledger:
        items.append(TakeoffItem(
            category="Lumber - Ledger",
            item="Ledger Board",
            size=f"{structure.joist_size} x {config.width_ft:.0f}'",
            quantity=1,
            unit="piece"
        ))
        
        bolt_count = int(config.width_ft / (16/12) * 2)  # Staggered at 16" O.C.
        items.append(TakeoffItem(
            category="Hardware",
            item="Ledger Lag Screw",
            size="1/2\" x 4\"",
            quantity=bolt_count,
            unit="each"
        ))
    
    # Rim joists
    rim_lf = (config.depth_ft * 2) + config.width_ft
    items.append(TakeoffItem(
        category="Lumber - Rim",
        item="Rim Joist",
        size=f"{structure.joist_size}",
        quantity=rim_lf,
        unit="LF"
    ))
    
    # Decking
    sqft = config.width_ft * config.depth_ft
    decking_lf = (sqft / (5.5/12)) * 1.1  # 10% waste
    items.append(TakeoffItem(
        category="Decking",
        item=f"Decking ({config.decking_type.value})",
        size="5/4 x 6",
        quantity=round(decking_lf),
        unit="LF",
        notes=f"Covers {sqft:.0f} SF with 10% waste"
    ))
    
    # Deck screws
    screw_lbs = sqft / 4
    items.append(TakeoffItem(
        category="Hardware",
        item="Deck Screws",
        size="#8 x 2-1/2\"",
        quantity=round(screw_lbs),
        unit="lbs"
    ))
    
    # Railing (if applicable)
    if config.railing_lf > 0:
        items.append(TakeoffItem(
            category="Railing",
            item=f"Railing System ({config.railing_type.value})",
            size="36\" height",
            quantity=config.railing_lf,
            unit="LF"
        ))
    
    # Stairs (if applicable)
    if config.stair_count > 0:
        items.append(TakeoffItem(
            category="Stairs",
            item="Stair Stringer",
            size=f"{config.stair_count}-tread",
            quantity=3,
            unit="each"
        ))
        items.append(TakeoffItem(
            category="Stairs",
            item="Stair Tread",
            size="5/4 x 12",
            quantity=config.stair_count,
            unit="each"
        ))
    
    return items


def export_takeoff_csv(items: list[TakeoffItem], output_path: str | Path) -> Path:
    """Export takeoff to CSV"""
    output_path = Path(output_path)
    
    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["Category", "Item", "Size", "Quantity", "Unit", "Notes"])
        
        for item in items:
            writer.writerow([
                item.category,
                item.item,
                item.size,
                item.quantity,
                item.unit,
                item.notes
            ])
    
    return output_path
```

---

## API Endpoints

Implement in `app/routers/quotes.py`:

```python
# app/routers/quotes.py
"""
Quote generation API endpoints
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional
from pathlib import Path
import tempfile
import uuid

from domain.models import SiteInput, DeckingType, RailingType, LedgerAttachment
from domain.code_engine import generate_structure
from services.pricing import calculate_quote
from services.permit_pdf import generate_permit_pdf
from services.quote_pdf import generate_quote_pdf
from services.takeoff import generate_takeoff, export_takeoff_csv


router = APIRouter(prefix="/api/v1/quotes", tags=["quotes"])

# Temporary storage for generated files (use S3/GCS in production)
TEMP_DIR = Path(tempfile.gettempdir()) / "kolmo_quotes"
TEMP_DIR.mkdir(exist_ok=True)


class QuoteRequest(BaseModel):
    """Input schema for quote generation"""
    # Dimensions (required)
    width_ft: float = Field(..., ge=4, le=40, description="Deck width in feet")
    depth_ft: float = Field(..., ge=4, le=24, description="Deck depth in feet")
    height_ft: float = Field(..., ge=0.5, le=14, description="Height from grade in feet")
    
    # Site conditions
    ledger_attachment: str = Field(
        "direct", 
        pattern="^(direct|standoff|freestanding)$",
        description="Ledger attachment type"
    )
    soil_bearing_psf: int = Field(1500, ge=1000, le=4000, description="Soil bearing capacity")
    
    # Customer selections
    decking_type: str = Field("trex", description="Decking material type")
    railing_type: str = Field("none", description="Railing type")
    railing_lf: float = Field(0, ge=0, description="Linear feet of railing")
    stair_count: int = Field(0, ge=0, le=20, description="Number of stair treads")
    
    # Project info
    customer_name: str = Field(..., min_length=1, description="Customer name")
    site_address: str = Field(..., min_length=1, description="Project address")


class QuoteResponse(BaseModel):
    """Output schema for quote generation"""
    success: bool
    quote_id: str
    
    # Pricing
    total_price: float
    price_per_sqft: float
    deck_sqft: float
    
    # File URLs
    permit_pdf_url: str
    quote_pdf_url: str
    takeoff_csv_url: str
    
    # Compliance
    code_compliant: bool
    notes: list[str]
    errors: list[str]


class ErrorResponse(BaseModel):
    success: bool = False
    errors: list[str]


@router.post("/generate", response_model=QuoteResponse | ErrorResponse)
async def generate_quote_package(request: QuoteRequest):
    """
    Generate complete quote package from site visit measurements.
    
    Returns URLs to download:
    - Permit PDF (SDCI submittal drawings)
    - Quote PDF (customer proposal)
    - Material takeoff (CSV)
    """
    
    # Map string inputs to enums
    try:
        decking_type = DeckingType(request.decking_type)
    except ValueError:
        decking_type = DeckingType.COMPOSITE_TREX
    
    try:
        railing_type = RailingType(request.railing_type)
    except ValueError:
        railing_type = RailingType.NONE
    
    try:
        ledger = LedgerAttachment(request.ledger_attachment)
    except ValueError:
        ledger = LedgerAttachment.DIRECT
    
    # Create site input
    site_input = SiteInput(
        width_ft=request.width_ft,
        depth_ft=request.depth_ft,
        height_ft=request.height_ft,
        ledger_attachment=ledger,
        soil_bearing_psf=request.soil_bearing_psf,
        decking_type=decking_type,
        railing_type=railing_type,
        railing_lf=request.railing_lf,
        stair_count=request.stair_count,
        customer_name=request.customer_name,
        site_address=request.site_address,
    )
    
    # Generate structure
    structure = generate_structure(site_input)
    
    if not structure.compliant:
        return ErrorResponse(errors=structure.errors)
    
    # Generate quote
    quote = calculate_quote(structure)
    
    # Generate unique ID for this quote
    quote_id = str(uuid.uuid4())[:8]
    
    # Generate PDFs
    permit_path = TEMP_DIR / f"{quote_id}_permit.pdf"
    quote_path = TEMP_DIR / f"{quote_id}_quote.pdf"
    takeoff_path = TEMP_DIR / f"{quote_id}_takeoff.csv"
    
    generate_permit_pdf(structure, permit_path)
    generate_quote_pdf(structure, quote, quote_path)
    
    takeoff_items = generate_takeoff(structure)
    export_takeoff_csv(takeoff_items, takeoff_path)
    
    return QuoteResponse(
        success=True,
        quote_id=quote_id,
        total_price=quote.total,
        price_per_sqft=quote.price_per_sqft,
        deck_sqft=quote.deck_sqft,
        permit_pdf_url=f"/api/v1/quotes/{quote_id}/permit.pdf",
        quote_pdf_url=f"/api/v1/quotes/{quote_id}/quote.pdf",
        takeoff_csv_url=f"/api/v1/quotes/{quote_id}/takeoff.csv",
        code_compliant=structure.compliant,
        notes=structure.notes,
        errors=structure.errors,
    )


@router.get("/{quote_id}/permit.pdf")
async def download_permit_pdf(quote_id: str):
    """Download permit PDF"""
    path = TEMP_DIR / f"{quote_id}_permit.pdf"
    if not path.exists():
        raise HTTPException(404, "Quote not found")
    return FileResponse(path, filename=f"permit_{quote_id}.pdf", media_type="application/pdf")


@router.get("/{quote_id}/quote.pdf")
async def download_quote_pdf(quote_id: str):
    """Download customer quote PDF"""
    path = TEMP_DIR / f"{quote_id}_quote.pdf"
    if not path.exists():
        raise HTTPException(404, "Quote not found")
    return FileResponse(path, filename=f"quote_{quote_id}.pdf", media_type="application/pdf")


@router.get("/{quote_id}/takeoff.csv")
async def download_takeoff(quote_id: str):
    """Download material takeoff CSV"""
    path = TEMP_DIR / f"{quote_id}_takeoff.csv"
    if not path.exists():
        raise HTTPException(404, "Quote not found")
    return FileResponse(path, filename=f"takeoff_{quote_id}.csv", media_type="text/csv")
```

---

## FastAPI Main App

Implement in `app/main.py`:

```python
# app/main.py
"""
Kolmo Deck Quote Builder API
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import quotes

app = FastAPI(
    title="Kolmo Deck Quote Builder",
    description="Generate permit drawings and quotes for residential decks per Seattle Tip 312",
    version="1.0.0",
)

# CORS (adjust origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://kolmo.io"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(quotes.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

---

## Docker Configuration

`Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy application
COPY . .

# Run
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`docker-compose.yml`:

```yaml
version: "3.8"

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - ENV=development
    volumes:
      - ./:/app
      - /tmp/kolmo_quotes:/tmp/kolmo_quotes
```

---

## pyproject.toml

```toml
[project]
name = "kolmo-deck-builder"
version = "1.0.0"
description = "Deck permit and quote generator for Kolmo Construction"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "pydantic>=2.5.0",
    "reportlab>=4.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.26.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

---

## Testing Requirements

Write tests in `tests/`:

### test_code_engine.py

```python
import pytest
from domain.models import SiteInput, LedgerAttachment
from domain.code_engine import generate_structure


def test_basic_deck_compliance():
    """16x12 deck should be compliant with standard framing"""
    site = SiteInput(
        width_ft=16,
        depth_ft=12,
        height_ft=4,
        customer_name="Test",
        site_address="123 Test St"
    )
    structure = generate_structure(site)
    
    assert structure.compliant is True
    assert len(structure.errors) == 0
    assert structure.joist_size == "2x10"
    assert len(structure.footings) >= 2


def test_excessive_cantilever_fails():
    """Cantilever > 25% of span should fail"""
    site = SiteInput(
        width_ft=16,
        depth_ft=8,  # Short depth
        height_ft=4,
        customer_name="Test",
        site_address="123 Test St"
    )
    # Note: With 8' depth and 2' default cantilever (25%), this should be borderline
    structure = generate_structure(site)
    # Adjust test based on actual cantilever logic


def test_tall_deck_uses_6x6_posts():
    """Decks over 8' should use 6x6 posts"""
    site = SiteInput(
        width_ft=16,
        depth_ft=12,
        height_ft=10,
        customer_name="Test",
        site_address="123 Test St"
    )
    structure = generate_structure(site)
    
    assert structure.post_size == "6x6"


def test_large_deck_has_adequate_footings():
    """24x16 deck should have at least 4 footings"""
    site = SiteInput(
        width_ft=24,
        depth_ft=16,
        height_ft=4,
        customer_name="Test",
        site_address="123 Test St"
    )
    structure = generate_structure(site)
    
    assert len(structure.footings) >= 4
```

### test_pricing.py

```python
import pytest
from domain.models import SiteInput, DeckingType
from domain.code_engine import generate_structure
from services.pricing import calculate_quote


def test_basic_quote_calculation():
    """Quote should produce reasonable total"""
    site = SiteInput(
        width_ft=16,
        depth_ft=12,
        height_ft=4,
        decking_type=DeckingType.COMPOSITE_TREX,
        customer_name="Test",
        site_address="123 Test St"
    )
    structure = generate_structure(site)
    quote = calculate_quote(structure)
    
    # 192 SF deck should be roughly $8,000-15,000
    assert 8000 <= quote.total <= 20000
    assert quote.deck_sqft == 192
    assert quote.price_per_sqft > 0


def test_line_items_sum_to_subtotal():
    """All line items should sum correctly"""
    site = SiteInput(
        width_ft=16,
        depth_ft=12,
        height_ft=4,
        customer_name="Test",
        site_address="123 Test St"
    )
    structure = generate_structure(site)
    quote = calculate_quote(structure)
    
    materials_sum = sum(li.material_cost for li in quote.line_items)
    labor_sum = sum(li.labor_cost for li in quote.line_items)
    
    assert abs(materials_sum - quote.materials_subtotal) < 0.01
    assert abs(labor_sum - quote.labor_subtotal) < 0.01
```

### test_permit_pdf.py

```python
import pytest
from pathlib import Path
import tempfile

from domain.models import SiteInput
from domain.code_engine import generate_structure
from services.permit_pdf import generate_permit_pdf


def test_permit_pdf_generates():
    """Permit PDF should generate without error"""
    site = SiteInput(
        width_ft=16,
        depth_ft=12,
        height_ft=4,
        customer_name="Test Customer",
        site_address="123 Test St, Seattle WA"
    )
    structure = generate_structure(site)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = Path(tmpdir) / "permit.pdf"
        result = generate_permit_pdf(structure, output_path)
        
        assert result.exists()
        assert result.stat().st_size > 1000  # Should be > 1KB
        assert result.stat().st_size < 10_000_000  # Should be < 10MB
```

---

## Acceptance Criteria

1. **POST /api/v1/quotes/generate** with valid input returns:
   - `success: true`
   - `quote_id` (8-char string)
   - `total_price` (reasonable range for deck size)
   - Valid URLs for all three files

2. **Code Engine** correctly sizes:
   - Joists based on span
   - Beams based on post spacing and joist span
   - Posts based on height
   - Footings based on tributary area

3. **Permit PDF** contains:
   - Framing plan with joists, beam, footings
   - Section view with all members
   - Proper dimensions
   - Title block with address

4. **Quote PDF** contains:
   - Customer info
   - Project summary
   - Total price
   - Terms

5. **Performance**: Quote generation < 3 seconds

---

## Sample Test Request

```bash
curl -X POST http://localhost:8000/api/v1/quotes/generate \
  -H "Content-Type: application/json" \
  -d '{
    "width_ft": 20,
    "depth_ft": 14,
    "height_ft": 4,
    "ledger_attachment": "direct",
    "soil_bearing_psf": 1500,
    "decking_type": "trex",
    "railing_type": "cable",
    "railing_lf": 34,
    "stair_count": 4,
    "customer_name": "John Smith",
    "site_address": "1234 Main St, Seattle WA 98101"
  }'
```

Expected response:
```json
{
  "success": true,
  "quote_id": "a1b2c3d4",
  "total_price": 19500.00,
  "price_per_sqft": 69.64,
  "deck_sqft": 280,
  "permit_pdf_url": "/api/v1/quotes/a1b2c3d4/permit.pdf",
  "quote_pdf_url": "/api/v1/quotes/a1b2c3d4/quote.pdf",
  "takeoff_csv_url": "/api/v1/quotes/a1b2c3d4/takeoff.csv",
  "code_compliant": true,
  "notes": [
    "Joists: 2x10 at 16\" O.C. (span 12.0')",
    "Beam: 2-2x10 (span 6.7', 4 posts)",
    "Posts: 4x4 at 3.2' height",
    "Footings: 12\" diameter x 18\" deep (tributary area 80 SF)"
  ],
  "errors": []
}
```
