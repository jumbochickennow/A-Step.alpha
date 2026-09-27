# A-Step design

## Direction

Keep the current A-Step identity: dark navy public pages, blue and coral accents, clear guidance, and light backgrounds on Contact, Consultation, and Resources. Improve feedback and loading states without changing the page designs.

## Existing foundations

- Colors and focus rings: `src/styles/tokens.css`.
- Latin font: A-Step Latin (local Inter variable); Arabic font: A-Step Arabic (local Cairo variable). Font loading: `src/styles/fonts.css`.
- Content container: `.container-shell` in `src/styles/globals.css` (`1280px` maximum, responsive side padding).
- Buttons: `src/components/common/Button.tsx`; navigation: `src/components/layout/Navbar.tsx`.

## Interaction rules

- Navigation hover and keyboard focus may preload the linked public route's existing lazy chunk. Navigation remains usable if a speculative download fails.
- Route loading uses a lightweight shape matching the destination page and its light or dark surface. Loading shapes are decorative; the localized loading status is announced once.
- Keep animation brief and tied to an action. Respect `prefers-reduced-motion` and leave content visible without animation.
- Preserve visible focus states, labels, keyboard navigation, and usable touch targets in all three languages.

## Last updated

- 2026-09-27: Documented the existing design and the route loading and preloading behavior.
- 2026-09-27: Added brief action feedback for the mobile drawer, consultation tabs, guide filtering, and form success; reduced-motion users see the final state immediately.
- 2026-09-27: Clarified the guide, consultation, and contact journeys in English, French, and Arabic; guide downloads prefer the available language matching the page.
