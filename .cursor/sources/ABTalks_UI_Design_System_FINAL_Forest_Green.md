# ABTalks UI Design System — Final Forest Green

ABTalks UI Design System v2
Page 1
ABTalks UI Design System v2
Responsive, component-led system for consistent ABTalks web experiences
Updated requirements incorporated: Outfit headings, Inter body/UI, 55px global header, 250px desktop
sidebar, white frosted-glass header, clay UI buttons, responsive architecture, and required
screen/component states.
1. Design Principles
The ABTalks interface should feel editorial, modern, human, confident, slightly playful, clean, and
evidence-driven. The system should avoid unnecessary variations in font sizes, spacing, radii, shadows,
and component dimensions. Use constrained tokens throughout the website.
Updated system rule: consistency across screens and devices is mandatory. A component is not
considered complete until its responsive behaviour and required interaction states are defined.
2. Typography
Element
Font
Desktop
Mobile
Weight
H1 / Display
Outfit
64 / 70
40 / 44
700
H2 / Section Title
Outfit
40 / 48
32 / 36
700
H3
Outfit
24 / 30
22 / 28
600
H4
Outfit
20 / 26
20 / 26
600
Paragraph
Inter
17 / 28
16 / 25
400
Body Small
Inter
14 / 21
14 / 21
400
Caption
Inter
12 / 16
12 / 16
400
Section Label
Outfit
13 / 18
13 / 18
600
Button
Inter
16 / 20
16 / 20
600
Form Label
Inter
14 / 20
14 / 20
500
Input
Inter
16 / 24
16 / 24
400
FAQ Question
Inter
18 / 27
16 / 24
600
FAQ Answer
Inter
16 / 25
16 / 25
400
Typography override: all headings use Outfit. All non-heading UI and body text uses Inter. Retain only
weights 400, 500, 600 and 700.
3. Color System
Token
Value
Usage
Primary Teal
#03535F
Primary buttons, active controls, key actions
Secondary Teal
#076573
Alternate filled actions / secondary teal surfaces
Accent Green
#18D39B
Accent and green interactive emphasis

ABTalks UI Design System v2
Page 2
Token
Value
Usage
4. Spacing System
Use a 4px base spacing system. Approved tokens: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120px.
Relationship
Desktop
Tablet
Mobile
Major section → major
section
96px
80px
64px
Related subsection →
subsection
64px
—
40px
Content gap
32px
24px
20px
Card padding
24px
24px
20px
Section label → heading
12px
12px
12px
Heading → paragraph
16px
16px
16px
Paragraph → CTA
24px
24px
24px
5. Container & Grid
Property
Desktop
Tablet
Mobile
Container
1280px max
Fluid
Fluid
Page padding
40px
32px
20px
Columns
12
8
4
Gutter
24px
24px
16px
Do not stretch long body copy across the full container. Target approximately 65 characters per line.
6. Global Header
Global header is a shared component and must remain visually and dimensionally consistent across all
screens.
Success Green
#27CA37
Success, verified and completed indicators
Success Green Dark
#197E23
Stronger success / verified text
Gray 200
#D2D2D2
Neutral badges / subtle controls
Gray 700
#626262
Borders and neutral UI detail
White
#FFFFFF
Cards, forms, white surfaces
Gray 100
#E9E9E9
Neutral navigation / soft surfaces
Gray 400
#A5A5A5
Disabled / tertiary text
Use the current ABTalks palette consistently. Do not reintroduce the previous orange palette as a primary UI color.

ABTalks UI Design System v2
Page 3
Property
Specification
Height
55px
Surface
White frosted glass
Desktop horizontal padding
40px
Mobile horizontal padding
20px
Interactive target
Minimum 44 × 44px
UI icon
20px visual size
Navigation type
Inter 14 / 20 / 500
CTA
Clay UI treatment
The header should use a white translucent/frosted surface, subtle border, restrained shadow, and
background blur. It should feel compact and unobtrusive. Do not create different header heights for
different screens.
7. Sidebar
Property
Specification
Desktop width
250px
Height
Full viewport
Internal horizontal padding
16–20px
Navigation text
Inter 14 / 20 / 500
Minimum item height
44px
Icon
20px visual size
Item radius
8px
On smaller screens, the sidebar does not compress into the content area. It becomes a collapsible drawer
/ overlay navigation while the global header remains 55px high.
8. Application Layout
Desktop application shell: 250px fixed sidebar + 55px global header + responsive main content. The main
content uses the container and grid tokens rather than screen-specific arbitrary widths.
Tablet: sidebar may collapse into a drawer; main content uses 32px page padding and the 8-column grid.
Mobile: sidebar becomes an overlay drawer; main content uses 20px page padding and the 4-column grid.
9. Buttons & Clay UI
Variant
Height
Horizontal padding
Type
Radius
Small
36px
16px
14 / 20 / 600
8px
Default
44px
20px
16 / 20 / 600
8px
Large CTA
48px
24px
16 / 20 / 600
8px

6A. HEADER NAVIGATION STYLE
The global header navigation follows a restrained editorial treatment.
Font
Inter
Case
UPPERCASE / ALL CAPS
Weight
400 / Regular / Light appearance
Font size
14px
Line height
20px
Letter spacing
0.08em
Color
#353535 / Text Secondary
Navigation gap
24px desktop / 20px mobile
Dropdown indicator
16px icon, aligned to text baseline
REFERENCE TREATMENT
F EATURES ⌄
RESOURCES ⌄
PRI CI NG
PRACTI CE CODI NG
Implementation rules
• Use the same navigation typography on every screen.
• Navigation labels should never use bold or semibold weight.
• Keep labels uppercase and visually airy through letter spacing.
• Do not increase tracking on headings, buttons, or body copy unless separately specified.
• Maintain a minimum 44 × 44px interactive area even when the visible label is smaller.
• On mobile, preserve the same typographic treatment inside the navigation drawer.
This section is part of the Global Header component and applies across desktop, tablet and mobile.

ABTalks UI Design System v2
Page 4
Clay treatment: use the ABTalks orange surface with subtle physical depth, a soft/wide shadow, restrained
elevation and no excessive glow. The button should feel tactile rather than futuristic.
State
Treatment
Default
 background, white text
Hover
 background, white text, slightly increased
elevation
Active
 background, reduced elevation / subtle press
Focus
2px  focus ring, 4px offset
Disabled
#E0E0E0 background, #8F8F8F text
Loading
Preserve button dimensions; replace/augment label with
progress indicator
Success
Clear success indicator/message without relying on color
alone
Error
Clear error indicator/message without relying on color alone
Icon-to-text spacing: 8px. Do not rely on color alone to communicate interaction states.
10. Cards
Variant
Padding
Radius
Border
Background
Standard
24px
12px
1px #E0E0E0
#FFFFFF
Small
20px
12px
1px #E0E0E0
#FFFFFF
Large
32px
16px
1px #E0E0E0
#FFFFFF
Use clay treatment selectively. Buttons and key interactive accents may use clay; information-heavy
cards should remain restrained to preserve hierarchy.
11. Radius & Shadow
Radius
Usage
4px
Tiny elements
8px
Buttons, inputs
12px
Cards
16px
Large cards / containers
24px
Special large surfaces
Shadow
Value
Usage
Small Card
0 2px 8px rgba(0,0,0,0.06)
Small card
Elevated Card
0 8px 24px rgba(0,0,0,0.08)
Elevated card
Floating Element
0 12px 32px
rgba(0,0,0,0.10)
Floating element

9A. CLAY UI BUTTON SYSTEM

The clay treatment stays visually identical to the Profile-page implementation. Only its color treatment is now part of the forest-green palette.

### Clay principle

- Soft tactile depth.
- Rounded geometry.
- Controlled lower inset depth.
- Restrained outer elevation.
- Not glossy, metallic, neon, heavily blurred, or excessively extruded.

### Button geometry

| Variant | Height | Horizontal padding | Radius |
|---|---:|---:|---:|
| Small | 36px | 16px | 10px |
| Default | 44px | 20px | 12px |
| Large CTA | 48px | 24px | 14px |

### Green clay recipe

```css
background: #03535F;
box-shadow:
  inset 0 -3px 6px rgba(0,0,0,.22),
  inset 0 1px 1px rgba(255,255,255,.14),
  0 4px 12px rgba(3,83,95,.16);
```

Hover uses `#076573` with stronger green-tinted elevation.

Pressed uses `#02434D` with reduced outer elevation and stronger inset depth.

Focus uses a visible 2px `#03535F` focus ring with 4px offset.

### Profile-page reference

Use the same visual logic found in the supplied Profile implementation: **surface + lower inset depth + restrained elevation**.

The current Profile implementation uses `#D4EBEC` for the active clay tab with an inset lower shadow of `#A6D2D5`. This establishes the tactile construction to preserve.

### Do not use

- Orange or any orange-derived color.
- Orange shadows.
- Glossy gradients.
- Neon glow.
- Sharp black drop shadows.
- Metallic bevels.
- Extreme 3D extrusion.
- Different clay recipes on different screens.

Clay is a component treatment, not a separate visual language.

12. Forms
Element
Specification
Form label
Inter 14 / 20 / 500
Label → input
8px
Input height
48px
Input typography
Inter 16 / 24 / 400
Horizontal padding
16px
Radius
8px
Border
1px #E0E0E0
Background
#FFFFFF
Input → next field
16px
Form group → form group
24px
Textarea minimum
120px
Input states: default, hover, focus, filled, validation error, validation success, disabled, and loading where
applicable. Error messaging sits directly below the input. Success uses a dedicated success treatment.
13. FAQ & Content Components
Component
Specification
FAQ question
Inter 18 / 27 / 600 desktop; 16 / 24 mobile
FAQ answer
Inter 16 / 25 / 400
FAQ item
Minimum 56px; 16px 20px padding; 12px radius
Expand icon
20px; 12px gap
FAQ item gap
8px
Testimonial quote
Inter 16 / 25 / 400
Person name
Inter 14 / 20 / 600
Role / company
Inter 13 / 18 / 400
Avatar
40px
Challenge category
Inter 12 / 16 / 600
Challenge title
Inter 16 / 22 / 600
Challenge description
Inter 14 / 20 / 400
14. Icon System

ABTalks UI Design System v2
Page 6
Icon type
Size
Small icon
16px
UI icon
20px
Feature icon
24px
Large decorative icon
32px
Use one consistent icon family. Do not mix outlined and filled styles, different stroke weights, or unrelated
visual families. Every clickable icon gets a minimum 44 × 44px hit area.
15. Responsive Architecture
Responsive design is part of the component definition. Desktop, tablet and mobile are not separate visual
systems; they are responsive expressions of the same token system.
System
Desktop
Tablet
Mobile
Page padding
40px
32px
20px
Grid
12 columns
8 columns
4 columns
Gutter
24px
24px
16px
Major section gap
96px
80px
64px
Content gap
32px
24px
20px
Card padding
24px
24px
20px
Header
55px
55px
55px
Sidebar
250px
Collapsible drawer
Overlay drawer
Responsive behaviour rule: components must reflow, resize, stack, collapse, or become scrollable when
required. Do not rely on fixed desktop widths that break on smaller devices.
Cards: 3-column layouts may become 2 columns on tablet and 1 column on mobile where the content
requires it. Forms should reduce columns and become single-column on mobile where necessary. Buttons
may remain inline when space permits and stack when required for clear hierarchy and touch usability.
Hero compositions should reduce from multi-column to a single-column mobile flow where required.
No arbitrary breakpoint-specific values should be introduced unless a component genuinely requires
them. Prefer the existing token system and component rules.
16. Screen State Matrix
Every applicable screen and interactive component must be designed for the following states.
State
Required treatment
Default
Normal populated state
Loading
Skeleton, spinner or progress treatment while preserving
layout
Empty
Explain what is missing and provide the next useful action
when applicable

ABTalks UI Design System v2
Page 7
State
Required treatment
Error
Clear problem statement, recovery action and
non-color-only indication
Success
Clear confirmation and next step where applicable
Disabled
Reduced emphasis with clear non-interactive treatment
Form validation
Inline field-level guidance, clear error/success treatment
Hover
Desktop pointer interaction where applicable
Active
Pressed/selected interaction state
Focus
Visible keyboard focus treatment
States should not cause avoidable layout jumps. Preserve component dimensions during loading and
interaction wherever practical.
17. Accessibility
Minimum body text: 16px. Minimum touch target: 44 × 44px. Visible focus states are required. Do not rely
on color alone. Maintain readable line lengths and clear hierarchy.
18. Handoff Requirements
A screen is not delivered until its user goal, flow, component behaviour, validation behaviour and
interaction notes are documented.
Handoff item
Required
User goal
Yes
Flow
Yes
Component behaviour
Yes
Validation behaviour
Yes
Interaction notes
Yes
Named developer
Yes
UI-UX sheet status
Approved
Developer receipt
Confirmed
The design must be approved before Wednesday so R1 and R12 can start. Status must read Approved on
the UI-UX sheet before development begins. Handoff must be to the named developer, not merely saved
in the design file.
19. Designer Acceptance Checklist
Requirement
Done
Every screen designed
☐
Default state
☐
Loading state
☐

ABTalks UI Design System v2
Page 8
Requirement
Done
Empty state
☐
Error state
☐
Success state
☐
Disabled state
☐
Form validation
☐
Desktop
☐
Tablet / responsive behaviour
☐
Mobile
☐
Header = 55px on all screens
☐
Sidebar = 250px desktop
☐
Outfit headings
☐
Inter body/UI
☐
Clay UI buttons
☐
User goal documented
☐
Flow documented
☐
Interaction notes documented
☐
Validation behaviour documented
☐
Named developer handoff
☐
UI-UX sheet = Approved
☐
20. Final Token Sheet
Category
Tokens
Typography
Outfit headings; Inter body/UI; weights 400/500/600/700
Spacing
4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120px
Radius
4, 8, 12, 16, 24px
Header
55px
Sidebar
250px desktop
Container
1280px max desktop
Page padding
40 / 32 / 20px
Grid
12 / 8 / 4 columns
Gutter
24 / 24 / 16px
Buttons
36 / 44 / 48px
Colors
#03535F; #076573; #18D39B; #27CA37; #197E23; #FFFFFF; #E9E9E9; #D2D
#A5A5A5; #8F8F8F; #787878; #626262; #4B4B4B; #353535; #000000; #F4F4

ABTalks UI Design System v2
Page 9
Category
Tokens
Input
48px
Textarea
120px minimum
Touch target
44 × 44px minimum
This document supersedes conflicting values in the previous design-system document only where
explicitly stated above: heading/body font assignment, global header height, desktop sidebar, clay UI
treatment, and responsive architecture/state requirements. Other established ABTalks tokens are
retained.


## FINAL COLOR GOVERNANCE

**Forest-green brand family:** `#03535F`, `#076573`, `#02434D`, `#D4EBEC`, `#E7F2F3`, `#EEF6F6`, `#18D39B`

**Success family:** `#27CA37`, `#197E23`, `#D6F7EC`

**Neutral family:** `#FFFFFF`, `#E9E9E9`, `#D2D2D2`, `#A5A5A5`, `#8F8F8F`, `#787878`, `#626262`, `#4B4B4B`, `#353535`, `#000000`

**Semantic-only:** `#D92D20`, `#FFEDB0`, `#AA821D`

### Forbidden legacy palette

No orange-derived brand/UI colors are permitted anywhere in the ABTalks system.
