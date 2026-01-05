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
