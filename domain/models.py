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
