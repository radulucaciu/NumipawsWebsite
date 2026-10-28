# NumiPaws landing page

Static marketing site for numipaws.com: plain HTML, CSS and one small script,
prerendered in English (`/`) and Romanian (`/ro/`). No framework, no npm
packages, no third-party requests on page load.

## Build

```bash
node build.mjs
```

Node 20 or newer, built-in modules only. Output goes to `dist/` (gitignored).
The build fails if a template references a copy key that is missing or empty,
or if `copy/en.json` and `copy/ro.json` do not have identical key trees.

## Preview

The Claude desktop app's preview config is in `.claude/launch.json` (server
name `site`). By hand:

```bash
python3 -m http.server 8787 --directory dist
```

Then open <http://localhost:8787/>. Add `?nolang` to a URL to stop the
saved-language redirect while testing.

## Build constants

At the top of `build.mjs`:

| Constant | Default | Meaning |
|---|---|---|
| `HEADLINE` | `'a'` | Hero headline: `'a'` = `hero.titleA`, `'b'` = `hero.titleB` |
| `YOUTUBE_ID` | `''` | YouTube video ID. Empty renders the play button disabled and omits the "plays from YouTube" note |
| `SITE` | `https://numipaws.com` | Canonical origin, used for `canonical`, `hreflang` and Open Graph URLs |
| `APP` | `https://app.numipaws.com/#/` | App base; login and signup links get `?lang=` and `role=` |

To add the video: put the ID in `YOUTUBE_ID`, rebuild. On click the poster is
replaced by an iframe from `www.youtube-nocookie.com`; nothing loads from
YouTube before the click. Keep the video marked general audience on YouTube.

To switch the headline: change `HEADLINE` to `'b'`, rebuild.

## Where things live

```
build.mjs                 template + copy -> dist/
copy/en.json, ro.json     all page copy (extracted from design/np-copy.js)
src/index.template.html   landing page
src/privacy.template.html, terms.template.html   placeholder pages
src/404.template.html     bilingual 404
src/styles.css, site.js   the only stylesheet and script
assets/                   images (png + webp), sanitized svg, fonts, og.png
public/                   _headers, _redirects, robots.txt, favicon.svg
design/                   imported Claude Design sources, reference only
scripts/images.sh         regenerates assets/*.png and *.webp from design/assets
```

Templates use `{{ path.to.key }}` (HTML-escaped) and `{{#if key}}...{{/if}}`
/ `{{#unless key}}...{{/unless}}`. Besides the copy, the build injects
`site.*` (lang, paths, canonical, headline, youtubeId, CSP meta) and
`links.*` (login, parent, teacher).

Copy keys not in the design deck were added to both JSON files: `nav.skip`,
`video.note`, `privacy.*`, `terms.*`, `notFound.*`. Everything else is the
deck verbatim.

## Images

`sh scripts/images.sh` caps every PNG at 480 px on the longest side and
writes a WebP next to it (needs `cwebp`; without it the PNG alone ships).
`assets/og.png` (1200x630) was rendered from an SVG composition of the
background, star, headline and two pets.

Fonts: Fredoka variable (400 to 700), `latin` and `latin-ext` subsets from
Google Fonts, self-hosted under `assets/fonts/` with the OFL license.

## Deploy: Cloudflare Pages

- Build command: `node build.mjs`
- Build output directory: `dist`
- No install step, no `package.json`.
- Headers and redirects come from `public/_headers` and `public/_redirects`.

The CSP in `_headers` is also emitted as a `<meta>` tag by the build (minus
`frame-ancestors` and `upgrade-insecure-requests`, which meta ignores) so
violations show up in the local console too. Side effect: Lighthouse's
robots.txt audit fails locally because `connect-src 'none'` blocks its fetch.

### Launch checklist

- Hardware-key or app 2FA on GitHub, Cloudflare and the registrar; no shared accounts.
- Registrar transfer lock, auto-renew, DNSSEC on.
- CAA record limiting issuers to Cloudflare and Let's Encrypt.
- `app.numipaws.com` must serve HTTPS before the apex goes live: HSTS uses `includeSubDomains`.
- Submit the domain to the HSTS preload list after the first deploy.
- Cloudflare Web Analytics is optional and a dashboard toggle, not code.
- Verify: securityheaders.com, Mozilla Observatory, SSL Labs, and every app link's `lang` and `role` query.

## Not in the repo yet

- Privacy and Terms text (pages show "Draft, text pending" with headings only).
- The contact address is a `mailto:hello@numipaws.com` placeholder.
- Romanian copy is the design deck's draft, unreviewed.
