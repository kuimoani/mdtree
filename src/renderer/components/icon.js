// Self-contained "leafless tree" app icon as an SVG string. Used both for the
// About dialog and for generating build/icon.ico, so it renders identically
// regardless of whether the system emoji font ships the 🪾 (Emoji 16.0) glyph.
export const APP_ICON_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="60" height="60" rx="14" fill="#223044"/>
  <g fill="none" stroke="#d6a76a" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32 57 V32" stroke-width="4.5"/>
    <path d="M32 41 L22 31 M22 31 L16 24 M22 31 L24 21" stroke-width="2.6"/>
    <path d="M32 38 L43 28 M43 28 L49 22 M43 28 L42 18" stroke-width="2.6"/>
    <path d="M32 33 V20 M32 23 L25 15 M32 23 L40 15 M32 18 L28 12 M32 18 L37 12" stroke-width="2.6"/>
  </g>
</svg>`
