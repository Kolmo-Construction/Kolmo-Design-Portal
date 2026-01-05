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
