---
name: F1 Paddock Insider
description: A race-aware Formula 1 product system for news, live timing, analytics, replay, media, standings, and Fantasy Pitwall.
colors:
  pit-carbon: "#0f0f0f"
  cockpit-panel: "#1a1a1a"
  control-surface: "#262626"
  telemetry-line: "#2a2a2a"
  race-red: "#e10600"
  timing-ink: "#f0f0f0"
  muted-timing: "#a0a0a0"
  mercedes-cyan: "#00d2be"
  mclaren-orange: "#ff8700"
  alpine-blue: "#0600ef"
  aston-green: "#006f62"
  signal-yellow: "#eab308"
  status-green: "#22c55e"
typography:
  display:
    fontFamily: "Mensura, sans-serif"
    fontSize: "3rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Mensura, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  title:
    fontFamily: "Mensura, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Mensura, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Mensura, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "2px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  page-x: "16px"
components:
  button-primary:
    backgroundColor: "{colors.race-red}"
    textColor: "{colors.timing-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.race-red}"
    textColor: "{colors.timing-ink}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.control-surface}"
    textColor: "{colors.timing-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input-default:
    backgroundColor: "{colors.pit-carbon}"
    textColor: "{colors.timing-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card-default:
    backgroundColor: "{colors.cockpit-panel}"
    textColor: "{colors.timing-ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: F1 Paddock Insider

## 1. Overview

**Creative North Star: "Pit Wall Desk"**

This system should feel like a serious race desk built for people who need the next signal quickly: what session is active, who is gaining, what changed, and where to go next. It is dark because the core product is often used during live sessions, with timing tables, video, analytics, and replay open on large screens or laptops. The dark surface lowers glare and lets race state, data color, and media carry the attention.

The product has two density modes. Casual surfaces such as news, schedule, standings, and galleries must be immediately readable and editorially polished. Operational surfaces such as live timing, analytics, replay, admin, and Fantasy Pitwall can be denser, but they must stay predictable, scannable, and grounded in standard controls.

The system rejects generic sports-news templates, beige or blue SaaS dashboards, gamer neon, decorative cyberpunk effects, ornamental gradients, glass effects, and repeated icon-card grids. Motorsport energy belongs in hierarchy, contrast, team colors, and race-aware data states, not in visual noise.

**Key Characteristics:**
- Dark race desk foundation with controlled F1 red accents.
- Dense but predictable product UI for live and analytical workflows.
- Editorial polish on public content without breaking the product vocabulary.
- Team and telemetry colors used as data language, not decoration.
- Compact radii, strong type weight, and fast state transitions.

## 2. Colors

The palette is a restrained dark operational system: carbon and panel neutrals carry most screens, Race Red marks action and selection, and data colors appear only when they encode team, tire, telemetry, or status meaning.

### Primary
- **Race Red**: Primary actions, active tabs, selected states, critical affordances, and small editorial tags. Its power comes from scarcity.

### Secondary
- **Mercedes Cyan**: Chart and team-data accent for secondary series, comparison lines, and telemetry where cyan is already meaningful.
- **McLaren Orange**: Chart and team-data accent for tertiary series, tire/heat-adjacent cues, and comparison states.
- **Alpine Blue**: Chart and team-data accent for deep comparison lines and motorsport identity cues.
- **Aston Green**: Chart and team-data accent for additional series, success-adjacent team data, and low-noise contrast on dark surfaces.

### Tertiary
- **Signal Yellow**: Warnings, active lap highlights, caution-adjacent readouts, and attention states that are not destructive.
- **Status Green**: Connected, saved, positive, and ready states. Do not use it as decoration.

### Neutral
- **Pit Carbon**: Page background and fixed chrome. This is the base canvas.
- **Cockpit Panel**: Primary card, modal, chart, and tool panel surface.
- **Control Surface**: Secondary controls, hover fills, inactive tabs, and toolbar backgrounds.
- **Telemetry Line**: Borders, dividers, input strokes, and structural separators.
- **Timing Ink**: Primary text on dark surfaces.
- **Muted Timing**: Secondary text, metadata, labels, and disabled-adjacent context.

### Named Rules

**The Red Is A Control Rule.** Race Red is for commands, selection, and state. Never spread it across inactive decoration.

**The Data Color Rule.** Cyan, orange, blue, green, and yellow must explain data. If a color does not encode a driver, team, compound, status, or chart series, remove it.

## 3. Typography

**Display Font:** Mensura (with sans-serif fallback)  
**Body Font:** Mensura (with sans-serif fallback)  
**Label/Mono Font:** Mensura today, with tabular/monospace styling applied in timing-heavy components where needed.

**Character:** Mensura gives the product a motorsport-native voice: condensed enough to feel technical, strong enough for headlines, and familiar enough for UI labels. It should be controlled carefully, because the same family carries editorial headlines, buttons, timing data, and form controls.

### Hierarchy
- **Display** (900, 3rem, 1 line-height): Hero headlines, race identity, and high-impact editorial titles only.
- **Headline** (700, 2rem, 1.15 line-height): Page titles, major panel headings, and dashboard section starts.
- **Title** (700, 1.125rem, 1.25 line-height): Card titles, chart headings, modal titles, and dense product headers.
- **Body** (400, 0.875rem, 1.5 line-height): General UI copy, article summaries, settings text, and readable supporting content. Keep prose around 65-75ch where possible.
- **Label** (700, 0.75rem, 0.08em letter spacing): Navigation, tags, compact labels, table metadata, and uppercase race-state markers.

### Named Rules

**The No Display Labels Rule.** Heavy display weight belongs to heroes and key race identity moments. Buttons, fields, tabs, and dense data labels must stay compact.

**The Scan First Rule.** Timing tables, leaderboards, and charts should privilege alignment, tabular numerals, and short labels over expressive typography.

## 4. Elevation

The system is mostly flat and layered by tone, border, and state. Depth comes from Pit Carbon page chrome, Cockpit Panel containers, Control Surface controls, and Telemetry Line borders. Shadows are allowed only as subtle product defaults or state feedback, never as decorative floating-card styling.

### Shadow Vocabulary
- **Low Product Shadow** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05)`): Existing shadcn-style component default for cards, inputs, and outline buttons. Keep it barely visible.
- **Focus Ring** (`0 0 0 3px rgba(225, 6, 0, 0.5)`): Keyboard and validation focus around controls. This is a state signal, not elevation.

### Named Rules

**The Tonal Layer Rule.** Use surface tone and border first. Add shadow only when a component needs interaction feedback or system consistency.

**The No Floating Dashboard Rule.** Analytics and timing screens should not become stacks of floating cards. Use full-width panels, tables, and restrained containers.

## 5. Components

### Buttons
- **Shape:** Compact squared controls with slight rounding (2px for editorial CTAs, 6px for product controls).
- **Primary:** Race Red fill with Timing Ink text, uppercase or strong label treatment, 36px height, and 16-20px horizontal padding.
- **Hover / Focus:** Hover darkens or reduces opacity without moving layout. Focus uses the Race Red ring.
- **Secondary / Ghost / Tertiary:** Secondary controls use Control Surface fills. Ghost controls are transparent until hover. Link buttons use Race Red text and underline on hover.

### Chips
- **Style:** Small uppercase pills or tags with Race Red, Control Surface, or data-color tints depending on meaning.
- **State:** Selected chips use solid or higher-contrast fills. Unselected chips stay quiet and must remain legible against Pit Carbon.

### Cards / Containers
- **Corner Style:** Product cards use 12px where inherited from the UI library; editorial tiles and hero cards often use 2px for a sharper motorsport feel.
- **Background:** Cockpit Panel for repeated content, Control Surface for nested controls, Pit Carbon for page backgrounds.
- **Shadow Strategy:** Flat by default; low shadow is acceptable only where the component library already applies it.
- **Border:** Telemetry Line borders define structure. Do not use thick colored side stripes.
- **Internal Padding:** 16px for compact panels, 24px for standard cards, 32px for larger editorial groupings.

### Inputs / Fields
- **Style:** Transparent or Pit Carbon fill, Telemetry Line border, 6px radius, 36px height, and 12px horizontal padding.
- **Focus:** Border shifts to Race Red with a visible ring. Focus must be clear on dark backgrounds.
- **Error / Disabled:** Destructive state uses Race Red only when the field is invalid. Disabled fields reduce opacity and never rely on color alone.

### Navigation

Navigation is fixed, dark, compact, and uppercase. Desktop navigation uses small high-confidence labels with a thin Race Red active or hover underline. Mobile navigation becomes a full-screen dark menu with large stacked links and progressive reveal, but it must remain simple enough to close and scan quickly.

### Signature Component: Featured Article Hero

The featured article hero is the bridge between editorial and product. It uses real imagery, dark bottom gradient for readability, a small Race Red category tag, a heavy uppercase headline, and a primary CTA. It must feel like a paddock publication, not a SaaS hero.

### Signature Component: Timing And Analytics Panel

Timing, replay, and analytics panels use dense tabs, compact selectors, chart surfaces, and data-first readouts. Use Race Red for active tab selection, muted neutrals for inactive states, and chart colors only when they encode series or race meaning.

## 6. Do's and Don'ts

### Do:
- **Do** put race context first: season, round, session, driver, team, or status should be visible before decorative content.
- **Do** use Pit Carbon, Cockpit Panel, Control Surface, and Telemetry Line as the default surface stack.
- **Do** reserve Race Red for primary actions, active selection, tags, and urgent state.
- **Do** use team and telemetry colors only as data language.
- **Do** keep product screens predictable: standard tabs, selects, tables, panels, buttons, and form controls.
- **Do** keep casual surfaces more editorial, but preserve the same dark system, red action language, and compact motorsport typography.
- **Do** maintain practical WCAG AA contrast, visible focus, keyboard access, and 44px touch targets on coarse pointers.

### Don't:
- **Don't** build generic sports-news templates with interchangeable article grids, ad-heavy composition, and weak visual hierarchy.
- **Don't** use beige or blue SaaS dashboards, finance-style executive reporting, or generic admin-panel styling that disconnects the product from motorsport.
- **Don't** use excessive gamer or neon aesthetics, decorative cyberpunk effects, or motion that competes with data readability.
- **Don't** add UI decoration that slows down live-session comprehension, especially oversized cards, repeated icon-card grids, ornamental gradients, glass effects, and visual noise around timing tables or analytics charts.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent on cards, list items, callouts, or alerts.
- **Don't** use gradient text, decorative glassmorphism, or hero-metric templates.
- **Don't** use display-scale type inside compact panels, sidebars, dashboards, or controls.
