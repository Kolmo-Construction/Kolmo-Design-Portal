/**
 * Kolmo Construction - Centralized Theme Configuration
 * 
 * All brand colors, typography, and styling are managed here
 * Apply theme.colors to ensure consistent branding across the site
 */

export const theme = {
  // Primary Colors
  colors: {
    // Primary: Dark blue/gray - used for text, headings, main elements
    primary: "#3d4552",
    primaryLight: "#4a5a6a",
    primaryDark: "#2d3540",
    
    // Accent: Golden orange - used for buttons, highlights, CTAs
    accent: "#db973c",
    accentLight: "#e8a84e",
    accentDark: "#c17d2a",
    
    // Secondary: Blue-gray - used for secondary elements, borders
    secondary: "#4a6670",
    secondaryLight: "#5a7a8a",
    secondaryDark: "#3a5660",
    
    // Neutrals
    background: "#ffffff",
    surfaceLight: "#f5f5f5",
    surfaceAlt: "#f0f0f0",
    border: "#e0e0e0",
    borderLight: "#e8e8e8",
    
    // Text colors
    textDark: "#3d4552",
    textMuted: "#7a8a99",
    textLight: "#b0b8c0",
    
    // Status colors
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",
  },

  // Typography
  typography: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    
    sizes: {
      h1: "2.5rem",
      h2: "2rem",
      h3: "1.5rem",
      h4: "1.25rem",
      h5: "1.125rem",
      h6: "1rem",
      body: "1rem",
      bodySmall: "0.875rem",
      bodySm: "0.75rem",
    },
    
    weights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },

  // Spacing scale
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "2.5rem",
    "3xl": "3rem",
    "4xl": "4rem",
  },

  // Border radius
  radius: {
    none: "0",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    full: "9999px",
  },

  // Shadows
  shadows: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
    xl: "0 20px 25px rgba(0, 0, 0, 0.1)",
    focus: "0 0 0 3px rgba(219, 151, 60, 0.1)",
  },

  // Gradients
  gradients: {
    accentGradient: "linear-gradient(135deg, #db973c 0%, #e8a84e 100%)",
    primaryGradient: "linear-gradient(135deg, #3d4552 0%, #4a6670 100%)",
    darkGradient: "linear-gradient(135deg, #2d3540 0%, #3a5660 100%)",
  },

  // Utility function to get color with opacity
  getColorWithOpacity: (color: string, opacity: number) => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  },
};

// CSS variable helper for use in styled components
export const themeVars = {
  primary: "var(--primary, #3d4552)",
  accent: "var(--accent, #db973c)",
  secondary: "var(--secondary, #4a6670)",
  background: "var(--background, #ffffff)",
  surfaceLight: "var(--muted, #f5f5f5)",
  textDark: "var(--foreground, #3d4552)",
  border: "var(--border, #e0e0e0)",
};

export default theme;
