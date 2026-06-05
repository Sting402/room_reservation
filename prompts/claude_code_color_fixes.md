Do not change reservation logic, data model, booking rules, conflict detection, duration logic, department dropdown, edit/cancel behavior, or backend/storage. Those parts are already fixed or handled elsewhere.

This task is only for visual clarity:

- color system
- background system
- card/table/modal surfaces
- semantic reservation status colors
- CSS variables/design tokens

Do not redesign the app from scratch. Preserve the current layout and structure unless a small spacing or readability adjustment is needed.

============================================================
DESIGN DIRECTION
============================================================

The app should feel like a clean professional internal company tool:

- calm
- readable
- not childish
- not too colorful
- not pure flat white everywhere
- not dark mode for now
- not a toy calendar
- not a flashy SaaS landing page

Design philosophy:

Background = silence.
Cards = paper.
Booked slot = blue ink.
Past slot = faded ink.
Warning = yellow sticky note.
Error = red stamp.
Success = green check.
Primary action = navy button.

Do not make the background visually compete with reservation states.
The background should be quiet.
The slots should speak.

============================================================
COLOR TOKENS
============================================================

Please implement the following as CSS variables/design tokens in one central place.

Use names like these or equivalent names that match the existing codebase.

Core colors:

--color-primary: #1E3A5F;
--color-primary-hover: #16304D;
--color-accent-blue: #3B82F6;

Text:

--color-text-main: #111827;
--color-text-subtle: #6B7280;
--color-text-muted: #9CA3AF;
--color-text-inverse: #FFFFFF;

Background / surfaces:

--color-bg-page: #F8FAFC;
--color-bg-section: #F1F5F9;
--color-bg-card: #FFFFFF;
--color-bg-table-header: #E2E8F0;
--color-bg-modal: #FFFFFF;
--color-bg-modal-overlay: rgba(15, 23, 42, 0.45);

Borders:

--color-border-soft: #E5E7EB;
--color-border-strong: #CBD5E1;

Slot states:

--color-slot-available-bg: #FFFFFF;
--color-slot-available-border: #E5E7EB;

--color-slot-booked-bg: #DBEAFE;
--color-slot-booked-text: #1E40AF;
--color-slot-booked-border: #93C5FD;

--color-slot-past-bg: #F3F4F6;
--color-slot-past-text: #9CA3AF;
--color-slot-past-border: #E5E7EB;

Success:

--color-success-bg: #DCFCE7;
--color-success-text: #166534;
--color-success-border: #86EFAC;

Warning:

--color-warning-bg: #FEF3C7;
--color-warning-text: #92400E;
--color-warning-border: #FCD34D;

Error:

--color-error-bg: #FEE2E2;
--color-error-text: #991B1B;
--color-error-border: #FCA5A5;

Lunch tag:

--color-lunch-bg: #FFF7ED;
--color-lunch-text: #9A3412;
--color-lunch-border: #FDBA74;

Early meeting tag:

--color-early-bg: #F3E8FF;
--color-early-text: #6B21A8;
--color-early-border: #C084FC;

Shadows:

--shadow-card: 0 1px 3px rgba(15, 23, 42, 0.08);
--shadow-modal: 0 20px 40px rgba(15, 23, 42, 0.18);

============================================================
BACKGROUND / SURFACE RULES
============================================================

1. Whole page background:
   - Use #F8FAFC.
   - Do not use pure white for the whole page.
   - Do not use dark mode.

2. Main content container:
   - Use white card background.
   - Add soft border.
   - Add subtle shadow.
   - It should feel like paper sitting on a quiet blue-gray desk.

3. Section panels:
   - Use #FFFFFF or #F1F5F9.
   - Avoid loud background blocks.

4. Table header:
   - Use light blue-gray, such as #E2E8F0.
   - Header text should be dark and readable.

5. Table cells / time slots:
   - Available = white with light gray border.
   - Booked = light blue background with dark blue text.
   - Past = light gray background with muted gray text.
   - Warning-only state = amber/yellow.
   - Blocking conflict/error = red.
   - Success = green only for toast/confirmation, not for large sections.

6. Modal popup:
   - Use white modal card.
   - Use dark transparent overlay:
     rgba(15, 23, 42, 0.45)
   - Use soft large shadow.
   - Keep form fields readable.
   - Do not use bright modal backgrounds.

7. Buttons:
   - Primary action button = navy.
   - Primary hover = darker navy.
   - Secondary button = white or light gray with border.
   - Dangerous/cancel action = red only when appropriate.
   - Do not make every button colorful.

8. Tags:
   - Lunch should be a small amber/orange tag.
   - Early meeting should be a small purple tag.
   - Tags should not dominate the whole cell.

9. Toast / alert:
   - Success toast = green.
   - Warning toast = amber.
   - Error toast = red.
   - Toasts should be readable and not oversized.

10. Selected / active state:

- Use navy outline, navy border, or navy header.
- Do not use loud neon colors.

============================================================
SEMANTIC COLOR RULES
============================================================

Use colors as language:

White = available.
Blue = booked.
Gray = past / disabled.
Amber = warning / lunch.
Red = blocking error / conflict.
Green = success.
Navy = primary action / selected / active.
Purple = early meeting tag.

Important:
Do not use too many saturated colors.
Do not randomly assign colors by room unless the existing app already depends on that.
Reservation status is more important than room decoration.

============================================================
READABILITY REQUIREMENTS
============================================================

1. Text contrast must remain readable.
2. Booked slot text must be readable on blue background.
3. Past slot must look disabled, but still readable.
4. Warnings must not look like blocking errors.
5. Errors must clearly look serious.
6. Main table must be easy to scan quickly.
7. Mobile view must remain readable.
8. Avoid cramped spacing if existing spacing is too tight.
9. Do not add heavy gradients.
10. Do not add decorative background patterns.

============================================================
IMPLEMENTATION REQUIREMENTS
============================================================

1. Prefer CSS variables/design tokens.
2. Avoid hardcoding the same color repeatedly across components.
3. Put the color system in one central CSS section/file.
4. Replace existing unclear colors with the semantic tokens.
5. Keep current layout mostly intact.
6. Do not touch reservation logic.
7. Do not touch storage/backend.
8. Do not rename data fields.
9. Do not break existing functionality.
10. If a component has inline styles, migrate color-related inline styles to CSS classes or variables if safe.

============================================================
WHAT TO CHECK AFTERWARDS
============================================================

After implementation, verify:

1. Page background is soft blue-gray, not pure white.
2. Main reservation area is a clean white card.
3. Available slots are white.
4. Booked slots are light blue.
5. Past slots are gray and disabled-looking.
6. Warning messages are amber/yellow.
7. Error/conflict messages are red.
8. Success messages are green.
9. Lunch tag is amber/orange and small.
10. Early meeting tag is purple and small.
11. Modal uses white card + dark overlay.
12. Buttons use navy primary and neutral secondary.
13. Text remains readable on desktop and mobile.
14. No reservation logic changed.
15. No console errors introduced.

============================================================
REPORT BACK
============================================================

Report:

1. Files changed
2. Where the design tokens were added
3. Which old colors were replaced
4. Any components that still use hardcoded colors
5. Desktop visual check result
6. Mobile visual check result
7. Confirmation that reservation logic was not changed
