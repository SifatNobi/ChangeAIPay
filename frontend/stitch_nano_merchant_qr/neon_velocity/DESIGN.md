# Design System Strategy: The Electric Flux

## 1. Overview & Creative North Star
The visual identity of this design system is anchored in a philosophy we call **"The Electric Flux."** In the high-stakes world of AI-driven fintech, we move away from the static, "safe" corporate blues of the past. Instead, we embrace a high-energy, editorial aesthetic that feels like a living pulse of data.

This system breaks the traditional "template" grid by using **intentional asymmetry** and **tonal depth**. We treat the screen not as a flat canvas, but as a deep, digital void where information is illuminated by neon currents. By utilizing extreme typography scales (massive headlines paired with microscopic, high-legibility labels), we create a sense of authoritative luxury that feels bespoke and engineered.

## 2. Colors: The Depth of the Void
The palette is built on a foundation of absolute darkness, allowing our electric accents to provide the only source of "light" in the interface.

*   **Primary (#54c3ff):** Our "Neon Signal." Use this for active states and critical path actions. 
*   **Surface Hierarchy:** We utilize the `surface-container` tiers to build architectural depth.
*   **The "No-Line" Rule:** To maintain a premium, seamless feel, **1px solid borders are strictly prohibited for sectioning.** You must define boundaries through background color shifts. For example, a `surface-container-low` card sits on a `surface` background. The contrast between the two hex codes is the "line."
*   **The Glass & Gradient Rule:** Floating elements (modals, navigation bars) should utilize **Glassmorphism**. Apply `surface-container` with 60% opacity and a 20px backdrop-blur. 
*   **Signature Textures:** For primary CTAs, do not use a flat fill. Apply a subtle linear gradient transitioning from `primary` (#54c3ff) to `primary-container` (#21b6f8) at a 135-degree angle. This provides a tactile "glow" inspired by the brand logo.

## 3. Typography: Editorial Authority
Our typography is a blend of technical precision and modern humanist curves.

*   **Display & Headlines (Space Grotesk):** This is our "Engineered" voice. Used for large data points and page titles. The geometric nature of Space Grotesk mirrors the precision of crypto-fintech.
*   **Body (Manrope):** Our "Human" voice. Manrope provides excellent readability for financial legibility while maintaining a modern, clean profile.
*   **Labels (Inter):** The "Utility" voice. Used for micro-copy and secondary metadata.

**Hierarchy Strategy:** Use `display-lg` for account balances to make them feel like a statement. Use `label-sm` in all-caps with 0.05em letter spacing for category headers to create a "dashboard" look.

## 4. Elevation & Depth: Tonal Layering
In a dark mode environment, traditional shadows can often feel "muddy." We use light and tone to create elevation.

*   **The Layering Principle:** Stacking determines importance.
    *   *Base:* `surface` (#0e0e0e)
    *   *Sectioning:* `surface-container-low` (#131313)
    *   *Floating Cards:* `surface-container` (#191919)
    *   *Pop-overs/Modals:* `surface-container-highest` (#262626)
*   **Ambient Shadows:** When an element must "float" (e.g., a primary action button), use a **Glow Shadow**. Instead of a dark shadow, use the `primary` color at 8% opacity with a 32px blur. This mimics the glow of the logo’s "Z" element.
*   **The "Ghost Border" Fallback:** If a container requires further definition for accessibility, use the `outline-variant` (#484848) at **15% opacity**. It should be felt, not seen.

## 5. Components

### Buttons
*   **Primary:** High-contrast `primary` fill with `on-primary` text. Use `rounded-xl` (1.5rem) for a friendly yet modern feel.
*   **Secondary:** `surface-container-highest` background with `primary` text. No border.
*   **Tertiary:** No background. `primary` text with a subtle underline or icon.

### Cards & Lists
*   **Card Style:** Use `rounded-lg` (1rem). 
*   **Strict Rule:** **No divider lines.** Separate list items using 12px or 16px of vertical white space (consistent with our spacing scale) or by alternating subtle background shifts between `surface-container-low` and `surface-container-lowest`.

### Input Fields
*   **State:** Default state is `surface-container-high` with no border. 
*   **Focus State:** A "Ghost Border" of `primary` at 40% opacity and a subtle `primary_dim` outer glow.
*   **Typography:** User input should always be `title-md` (Manrope) for maximum clarity during financial entry.

### Chips
*   **Visual:** Pill-shaped (`rounded-full`). Use `secondary-container` for the background and `on-secondary-container` for text. These should feel like small, tactile "tokens" within the interface.

### Fintech Specific: The "Flux" Graph
*   For data visualizations, use a 3px stroke width for the line. Use a gradient stroke that transitions from `primary` to `tertiary` (#a4a1ff) to represent market movement.

## 6. Do’s and Don’ts

### Do:
*   **Use breathing room:** Give financial data room to exist. High contrast requires more white space to avoid visual fatigue.
*   **Layer your surfaces:** Always place higher-tier containers on lower-tier backgrounds.
*   **Mirror the logo:** Use the rounded, concentric shapes from the brand logo as inspiration for iconography and container shapes.

### Don’t:
*   **Don't use pure white (#FFFFFF) for body text:** Use `on-surface-variant` (#ababab) for secondary text to reduce eye strain. Save pure white for primary headlines.
*   **Don't use 1px borders:** If you feel the need to add a line, use a background color change instead.
*   **Don't use standard "Drop Shadows":** Use the "Electric Glow" method (tinted shadows) to maintain the "The Electric Flux" aesthetic.