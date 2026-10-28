# NumiPaws landing page: implementation plan

Goals, in priority order:
1. Near-zero running cost.
2. Smallest possible attack surface.
3. Faithful reproduction of the Claude Design page (`NumiPaws Landing Page.dc.html`).

## What the design actually is

The design project was imported and read. Findings that shape the plan:

- `NumiPaws Landing Page.dc.html` is a review canvas. It composes three real
  component files: `Landing.dc.html` (the page, 500 lines, desktop and mobile
  branches), `LangSwitch.dc.html` (language dropdown) and `VideoFrame.dc.html`
  (16:10 poster with a play button; no actual video exists yet).
- `np-copy.js` is the copy deck: every string on the page, keyed, in English
  and Romanian. The Romanian is marked "draft for review".
- `support.js` is NOT a support form. It is the design tool's React-based
  template runtime. It must not ship: it needs React on `window`, evaluates
  template code at runtime, and would force `unsafe-eval` into the CSP.
- The page has no forms, no inputs, no network calls. Every call to action is
  a link into the app at `https://app.numipaws.com/#/` with `?lang=` and a
  `role=` query. Footer Privacy / Terms / Contact links are `href="#"`
  placeholders.
- Runtime behaviour: language switch re-renders strings in place and persists
  the choice in `localStorage` key `numipaws.lang`; a mobile hamburger menu;
  a decorative star counter ticking 24 to 36; a "Copy" button in the mock
  teacher roster that writes a sample code to the clipboard; bob and pop
  animations with a `prefers-reduced-motion` guard. Hover and pressed states
  are expressed as `style-hover` / `style-active` attributes (14 of them).
- Styling is entirely inline `style=""` attributes; the font is Fredoka from
  Google Fonts. Pet art is 17 PNGs under `assets/`, shown at 420px or less.
  `assets/star.svg` carries a 10 KB C2PA metadata blob around a 300-byte icon.
- Two hero headline variants (A/B). Design default is A.

The `design/` folder in this repo holds the imported `Landing.dc.html` for
reference. The other sources are re-fetched from the design project during
implementation (`np-copy.js`, `LangSwitch.dc.html`, `VideoFrame.dc.html`,
`assets/*`). The project's `uploads/` folder is reference art and is not used.

## Architecture: static files, no backend, no framework

Output is plain HTML, CSS and one small JavaScript file. No React, no npm
dependencies, no third-party scripts, no external CDNs, no cookies.

Hosting: Cloudflare Pages, free tier.
- Unlimited bandwidth, free TLS, DDoS mitigation and basic WAF included, so a
  traffic spike cannot produce a bill.
- Response headers come from a versioned `_headers` file.
- Deploys from a private GitHub repo on push to `main`; preview deploys per
  branch.

Expected cost: $0/month plus the domain (about $10/year).

## Internationalisation: prerender both languages

Instead of swapping strings in the browser, a build step renders two complete
pages from one template and the copy deck:

- `/` English, `/ro/` Romanian, cross-linked with `<link rel="alternate"
  hreflang>` and each with `<html lang>` set.
- The language switcher is a plain link to the other page. It works with
  JavaScript disabled and search engines index both languages.
- "Remembers the choice": the switcher link sets `localStorage.numipaws.lang`
  on click, and a three-line script on each page redirects to the saved
  language on arrival if it differs. The `?lang=` query on app links is baked
  in per page.

The build step is `build.mjs`: Node with built-in modules only, no packages.
It reads `copy/en.json` and `copy/ro.json` (extracted from `np-copy.js`) and
`src/*.template.html`, substitutes `{{ key }}` placeholders with HTML-escaped
values, and writes `dist/`. Cloudflare Pages runs `node build.mjs` with no
`npm install`. The hero headline variant is a build constant, default A.

## Porting rules (how the design becomes the site)

1. One responsive layout replaces the separate desktop and mobile branches.
   Reference widths: 1440 and 390. Container queries where the design uses
   `cqw` units; media queries for the nav and section stacking.
2. Every inline style moves to `styles.css` classes. Hover and pressed states
   become `:hover` / `:active` rules. This is what makes `style-src 'self'`
   possible.
3. JavaScript that remains, all in `site.js` (`defer`, no inline scripts):
   - saved-language redirect and the switcher's `localStorage` write
   - mobile menu open/close (button toggles a class; Escape closes)
   - language dropdown open/close with the design's ARIA contract
     (`aria-haspopup="menu"`, `menuitemradio`, `aria-checked`, Escape and
     outside click close)
   - the decorative star counter tick, skipped under reduced motion
   - the video play button swapping the poster for the YouTube iframe
   The roster "Copy" button becomes purely visual (no clipboard access): it is
   a mock dashboard, and the sample code is not real.
4. Video section: click-to-load YouTube. The page ships the poster and play
   button exactly as designed, with no YouTube code present. On click,
   `site.js` replaces the poster with an iframe from
   `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&rel=0`, with
   `allow="autoplay; fullscreen"` and `loading="lazy"`. Nothing from Google
   loads until the visitor asks for it, so performance and the no-banner
   stance survive. A short "Plays from YouTube" note sits under the button
   and the privacy policy names YouTube as the one third party. The video ID
   is a build constant; until one exists the button is rendered but
   disabled. Keep the video marked general audience on YouTube, not "made
   for kids", since the viewer is the parent.
5. Footer: Privacy and Terms become real pages `/privacy/` and `/terms/`
   (also prerendered in both languages; content supplied by you, see Open
   items). Contact becomes a `mailto:` link.
6. Fonts: self-host Fredoka (SIL Open Font License) as two woff2 subsets,
   `latin` and `latin-ext` (Romanian ș ț ă â î), with `font-display: swap` and
   a preload for the main weight. The Google Fonts link is dropped.
7. Images: strip metadata from every SVG (star, two flags) and inline the star
   icon where it repeats in the nav and pills. Convert PNGs to WebP (and
   AVIF) with PNG fallback via `<picture>`, cap at 480px wide as the design
   specifies, set explicit width and height, lazy-load everything below the
   hero.
8. Accessibility carried over: alt text from the copy deck, `lang` attributes
   on language rows, reduced-motion guard, keyboard-operable menus.

## Security

Threat model for a static marketing page, and the control for each:

| Threat | Control |
|---|---|
| Account takeover (GitHub, Cloudflare, registrar) | Hardware-key or app 2FA on all three; no shared accounts; Cloudflare API tokens scoped and unused |
| DNS / domain hijack | Registrar transfer lock, DNSSEC on, auto-renew, CAA record limiting issuers to Cloudflare and Let's Encrypt |
| Supply-chain compromise | Zero npm dependencies, zero third-party scripts, zero external CDNs; fonts and images self-hosted; build script is 100 lines of plain Node you can read; the only third-party content is a YouTube iframe loaded on click |
| Cross-site scripting | Strict CSP with no `unsafe-inline` and no `unsafe-eval`; all JS and CSS in files; build escapes every copy string; no `innerHTML` anywhere |
| Clickjacking | `frame-ancestors 'none'` plus `X-Frame-Options: DENY` |
| Downgrade / MITM | HSTS with `includeSubDomains; preload`, submitted to the preload list |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Referrer leakage to the app or elsewhere | `Referrer-Policy: strict-origin-when-cross-origin` |
| Unneeded browser APIs | `Permissions-Policy` denying camera, mic, geolocation, payment, USB |
| Tab-nabbing via outbound links | `rel="noopener noreferrer"` on every link that leaves the origin |
| Malicious or bloated SVG | Metadata stripped, no scripts or event handlers, served as `<img>` or inlined from a reviewed source |
| Spam to the contact address | `mailto:` only, no form, no backend to abuse |

`_headers` as shipped:

```
/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'none'; frame-src https://www.youtube-nocookie.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

Three consequences to be aware of:
- `frame-src` is the only entry that names a third party. It allows one
  origin-isolated iframe, created only on a click; scripts, styles, images
  and fonts stay first-party.
- `includeSubDomains` on HSTS also binds `app.numipaws.com` to HTTPS. That is
  desirable, but the app must serve HTTPS before the apex goes live with it.
- The CSP is for this site only. The app on its subdomain sets its own.

Analytics: Cloudflare Web Analytics, enabled from the dashboard with no
script tag. Cookieless, so no consent banner and nothing to leak. Can be left
off entirely.

## Repository layout

```
build.mjs                 Node, built-ins only: template + copy -> dist/
copy/en.json  copy/ro.json
src/index.template.html   the landing page
src/privacy.template.html src/terms.template.html
src/styles.css  src/site.js
assets/                   webp/avif/png art, sanitized svg, woff2 fonts
public/_headers _redirects robots.txt favicon.svg 404.html
design/                   imported design sources, reference only
dist/                     build output, gitignored
.claude/launch.json       local preview server for dist/
```

`_redirects` maps `www` to the apex and `/index.html` to `/`.

## Implementation steps

1. `git init`, `.gitignore` (`dist/`, `.DS_Store`), `README.md`.
2. Fetch the remaining design sources and the 17 PNGs plus 3 SVGs from the
   design project into `design/`. Extract `copy/en.json` and `copy/ro.json`
   from `np-copy.js`.
3. Write `build.mjs`: load copy, render templates for `en` and `ro`, escape
   values, write `dist/`, copy `public/` and `assets/`. Fail the build on any
   unresolved placeholder or missing key, so a copy mismatch between languages
   cannot ship.
4. Port the page: `src/index.template.html` section by section (nav, hero,
   video, how it works, seven games, for kids, for parents, for teachers,
   trust strip, final CTA, footer), moving all styling into `styles.css`.
5. Write `site.js` per the porting rules. Confirm it runs under the strict CSP
   with zero console violations.
6. Process assets: sanitize SVGs, convert and resize PNGs, subset and
   self-host Fredoka.
7. Add `<head>` metadata from the copy deck's `meta` keys, Open Graph tags,
   `hreflang` links, canonical URLs, favicon, `robots.txt`.
8. Privacy and Terms pages from the text you supply, same template system.
9. Local verification: `node build.mjs`, serve `dist/` through the app's
   preview, check both languages at 390 and 1440, keyboard-only navigation,
   reduced-motion, and Lighthouse 95+ on all four scores.
10. Deploy: private GitHub repo, Cloudflare Pages project with build command
    `node build.mjs` and output `dist`, custom domain, DNSSEC, CAA record,
    HSTS preload submission, 2FA everywhere.
11. Live verification: securityheaders.com A+, Mozilla Observatory A+,
    SSL Labs A+, and every app link resolves with the right `lang`.

## Open items (defaults applied unless you say otherwise)

- Hero headline: variant A ("Math practice kids actually ask for."), the
  design default. One-line change in `build.mjs` to switch.
- Video: click-to-load YouTube from the nocookie domain. The video ID is
  a build constant; the button is disabled until you provide one.
- Contact: `mailto:` to an address you choose. Placeholder until then.
- Privacy and Terms text: needed from you. A children's product serving the
  EU and likely the US needs a policy that covers GDPR-K and COPPA; I can
  draft a structure, but the content is a legal decision.
- Romanian copy: ported as-is from the deck, flagged "draft" in the design.
  Review it before launch.
