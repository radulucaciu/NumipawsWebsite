# Putting numipaws.com online

Step-by-step from this folder to a live site on Cloudflare Pages, in the
order the steps depend on each other. Everything here is the free tier; the
only recurring cost is the domain.

What the repo already provides: the build (`node build.mjs` -> `dist/`), the
response headers (`public/_headers`), the www -> apex redirect
(`public/_redirects`), `robots.txt`, `404.html` and the favicon. Nothing in
this guide changes code; it is all accounts, dashboard settings and DNS.

You need: a GitHub account, a Cloudflare account, the numipaws.com domain at
a registrar you can log in to, Node 20+ and git on this Mac (both present).

---

## 0. Before you start (5 min)

1. Turn on two-factor auth (authenticator app or hardware key, not SMS) on
   GitHub, Cloudflare and the registrar. Everything below hangs off these
   three logins.
2. Check who the commits are from. The four commits in this repo were made
   with the git identity configured on this Mac:

   ```bash
   git log --format='%an <%ae>' | sort -u
   ```

   If that is a work address you do not want on a personal GitHub repo,
   fix it before pushing (history is not public yet, so rewriting is free):

   ```bash
   git config user.email "you@example.com" && git rebase --root --exec 'git commit --amend --no-edit --reset-author'
   ```

3. Decide the three things the build bakes in, at the top of `build.mjs`:
   `HEADLINE` (`'a'` now), `YOUTUBE_ID` (empty now, play button disabled) and
   the contact address (`hello@numipaws.com` in the templates). All three can
   change later with a commit; none blocks going live.

## 1. Final local check (2 min)

```bash
node build.mjs
```

Must print `built 7 pages into dist/` with no warning line. Then preview:

```bash
python3 -m http.server 8787 --directory dist
```

Open <http://localhost:8787/>, <http://localhost:8787/ro/> and
<http://localhost:8787/privacy/>. The browser console should be empty.

## 2. Create the GitHub repo and push (5 min)

1. On GitHub: **New repository**, name `numipaws-website`, **Private**, no
   README / .gitignore / license (the repo already has them). Copy the SSH or
   HTTPS URL it shows.
2. In this folder:

   ```bash
   git remote add origin git@github.com:YOUR_USER/numipaws-website.git
   ```

   ```bash
   git push -u origin main
   ```

   The branch is already called `main`. `dist/` is gitignored and must not
   be pushed; Cloudflare builds it.
3. Optional but cheap: **Settings > Branches > Add rule** for `main`,
   tick "Require a pull request before merging". It stops an accidental push
   from deploying.

From now on, every push to `main` is a production deploy and every other
branch gets its own preview URL.

## 3. Add the domain to Cloudflare (15 min, then wait)

1. Cloudflare dashboard: **Add a domain** (previously "Add a site"), enter
   `numipaws.com`, pick the **Free** plan.
2. Cloudflare scans the existing DNS. Review the list: keep any records you
   still need (mail, the `app` subdomain), delete anything stale. Do not add
   anything for the apex or `www` yet; Pages will create those.
3. Cloudflare shows two nameservers. At the registrar, replace the current
   nameservers with those two.
4. Wait until the zone shows **Active** (minutes to a few hours). You can
   continue with step 4 while waiting; the custom domain step (5) needs the
   zone active.

If the registrar is not Cloudflare and you want one less account to secure,
you can transfer the domain to Cloudflare Registrar later (Domain
Registration > Transfer); it needs the zone active first and about a week.

## 4. Create the Pages project (10 min)

1. **Workers & Pages > Create > Pages > Connect to Git**. Authorize the
   GitHub app for the `numipaws-website` repo only (not all repos).
2. Select the repo. Build settings:

   | Field | Value |
   |---|---|
   | Project name | `numipaws` (becomes `numipaws.pages.dev`) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `node build.mjs` |
   | Build output directory | `dist` |
   | Root directory | leave empty |

3. **Environment variables** (same values for Production and Preview):

   | Name | Value | Why |
   |---|---|---|
   | `NODE_VERSION` | `22` | Pins the Node major; the build needs 20+ and the current image default is 22 anyway |
   | `SKIP_DEPENDENCY_INSTALL` | `1` | There is no `package.json`, so nothing to install; this makes that explicit |

4. **Save and Deploy**. The first build takes about a minute. The log should
   end with `built 7 pages into dist/` and a `https://numipaws.pages.dev`
   URL.
5. Open the `.pages.dev` URL and check `/`, `/ro/`, `/privacy/`, `/404`
   (any wrong path) and the language dropdown. Then:

   ```bash
   curl -sI https://numipaws.pages.dev/ | grep -i -E 'content-security|strict-transport|x-frame'
   ```

   All three headers must be present; that proves `_headers` is being read.

## 5. Attach the custom domain (5 min, then wait for the certificate)

Needs the zone from step 3 to be **Active**.

1. In the Pages project: **Custom domains > Set up a custom domain**, enter
   `numipaws.com`. Because the zone is on Cloudflare it creates the CNAME
   for you; confirm.
2. Repeat for `www.numipaws.com`. This is required for the www redirect: the
   rule in `_redirects` only runs when `www` reaches the project.
3. Wait until both show **Active** (certificate issued, usually a few
   minutes).
4. Check:

   ```bash
   curl -sI https://www.numipaws.com/ro/ | grep -i -E '^(HTTP|location)'
   ```

   Expect `301` and `location: https://numipaws.com/ro/`.

## 6. Zone settings (10 min)

All under the `numipaws.com` zone in the Cloudflare dashboard.

**SSL/TLS**

- **Overview**: encryption mode **Full (strict)**.
- **Edge Certificates**: **Always Use HTTPS** on, **Minimum TLS Version**
  1.2, **TLS 1.3** on. Leave the dashboard **HSTS** toggle off: the site
  already sends `Strict-Transport-Security` from `_headers`, and one source
  of truth is easier to reason about.

**Features that inject scripts or rewrite HTML: keep off.** The CSP
(`script-src 'self'`, `connect-src 'none'`) blocks them and they would show
up as console errors or broken mailto links:

- **Speed > Optimization**: Rocket Loader off.
- **Security > Settings**: Email Address Obfuscation off (it rewrites the
  footer `mailto:` and injects a script), Bot Fight Mode off (its JS
  detection posts to `/cdn-cgi/...`, which `connect-src 'none'` blocks;
  a static site has nothing for bots to abuse).
- Do not add **Zaraz** or **Web Analytics**. Both inject a beacon script.
  If you want visitor counts later, the honest change is to widen
  `script-src` and `connect-src` in `public/_headers` for
  `static.cloudflareinsights.com` and `cloudflareinsights.com`, and accept
  one third-party request per page view.

**DNS > Settings**

- **DNSSEC**: Enable. Cloudflare shows a DS record; add it at the registrar
  (if the registrar is Cloudflare this is automatic). Wait for "Success".

**DNS > Records: CAA.** Either leave CAA alone (Cloudflare then issues
freely, which is the default for most zones) or, to limit who may issue
certificates for the name, add all of the CAs Cloudflare itself uses, else
certificate renewal fails. As of this writing:

| Type | Name | Flags | Tag | Value |
|---|---|---|---|---|
| CAA | `numipaws.com` | 0 | issue | `letsencrypt.org` |
| CAA | `numipaws.com` | 0 | issue | `pki.goog; cansignhttpexchanges=yes` |
| CAA | `numipaws.com` | 0 | issue | `ssl.com` |
| CAA | `numipaws.com` | 0 | issue | `sectigo.com` |
| CAA | `numipaws.com` | 0 | issuewild | the same four values |
| CAA | `numipaws.com` | 0 | iodef | `mailto:hello@numipaws.com` |

Before adding them, re-check the list against Cloudflare's "Certificate
authorities" reference page; it changes.

## 7. Registrar (5 min)

- Transfer lock on, auto-renew on, payment method valid.
- WHOIS privacy on.
- Nameservers set to Cloudflare (step 3) and the DS record added (step 6).

## 8. HSTS preload (after everything above is live)

`_headers` already sends `max-age=63072000; includeSubDomains; preload`.
Submitting the domain to browsers' built-in list is a separate, nearly
irreversible step. Do it only when:

1. `https://numipaws.com` and `https://www.numipaws.com` both work and
   `http://` versions redirect to HTTPS (Always Use HTTPS does that).
2. **Every** subdomain you will ever serve, including `app.numipaws.com`,
   is served over valid HTTPS. `includeSubDomains` means a browser that has
   seen the apex will refuse plain-HTTP on any subdomain.

Then submit at <https://hstspreload.org/>, which also checks the conditions
for you. Inclusion ships with the next browser releases (weeks).

## 9. Verify the live site (10 min)

- <https://securityheaders.com/?q=numipaws.com> : expect A+.
- <https://observatory.mozilla.org/> : expect A+.
- <https://www.ssllabs.com/ssltest/> : expect A+.
- Lighthouse (Chrome DevTools) on `/` and `/ro/`: expect roughly 99 / 97 /
  100 / 100. The robots.txt audit that failed locally passes live.
- Click every app link (Log in, parent and teacher sign-up, in both
  languages) and confirm the `lang=` and `role=` query reaches the app.
- Pick Română in the switcher, close the tab, reopen `numipaws.com`: it
  should land on `/ro/`.
- DNSSEC: <https://dnsviz.net/d/numipaws.com/dnssec/> all green.

## 10. Day-to-day

- **Deploy a change**: commit, push to `main`. Cloudflare builds and
  publishes in about a minute. Open the deployment's log if the site does
  not change.
- **Preview a change first**: push a branch, Cloudflare posts a
  `*.numipaws.pages.dev` preview URL on the commit / PR.
- **Roll back**: Pages project > Deployments > the previous one >
  **Rollback to this deployment**. Instant.
- **Add the video**: set `YOUTUBE_ID` in `build.mjs`, commit, push. Make
  sure the video is marked general audience on YouTube.
- **Privacy / Terms text**: replace the draft paragraphs in
  `src/privacy.template.html` and `src/terms.template.html` (and the
  `privacy.*` / `terms.*` strings in `copy/en.json` and `copy/ro.json`),
  remove the `noindex` meta on those pages, commit, push.
- **Change the contact address**: it appears in `src/index.template.html`,
  `src/privacy.template.html` and `src/terms.template.html` (`mailto:`), and
  in the CAA iodef record if you added one.
- **Images**: drop PNGs in `design/assets/`, run `sh scripts/images.sh`,
  commit the generated files in `assets/`.

## Quick checklist

- [ ] 2FA on GitHub, Cloudflare, registrar
- [ ] Commit author email is the one you want public
- [ ] Repo pushed, private, `main`
- [ ] Zone active on Cloudflare nameservers
- [ ] Pages project builds with `node build.mjs` -> `dist`, `NODE_VERSION=22`
- [ ] Headers present on `.pages.dev`
- [ ] `numipaws.com` and `www.numipaws.com` attached, www redirects
- [ ] Full (strict), Always Use HTTPS, TLS 1.2 min
- [ ] Rocket Loader, Email Obfuscation, Bot Fight Mode off; no Web Analytics
- [ ] DNSSEC on, DS at registrar
- [ ] CAA decided (none, or the full Cloudflare set)
- [ ] Registrar lock, auto-renew, WHOIS privacy
- [ ] `app.numipaws.com` on HTTPS, then HSTS preload submitted
- [ ] securityheaders / Observatory / SSL Labs / Lighthouse / app links checked
