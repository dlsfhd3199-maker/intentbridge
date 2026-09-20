# IntentBridge Public Website 1.0

## Routes and entry

| URL | Experience |
| --- | --- |
| `/` | Public product homepage, including for signed-in visitors |
| `/login` | Existing Credentials login form |
| `/signup` | Same form, initially in signup mode; existing PENDING approval flow |
| `/dashboard` | Former `/` dashboard, with the same role-specific UI and permission |
| Other existing App/API URLs | Unchanged |

Only the former root dashboard moved. Existing bookmarks to `/` now open the public homepage. Dashboard links and the MANAGER assigned-workspaces anchor use `/dashboard`. The public header/hero/footer link into the existing signup and login flow. After login, the existing role-specific dashboard renders at `/dashboard`.

## Presentation and data

- Hero dashboard, customer journey, audience/campaign and forecast previews are Server Components in `features/public/product-preview.tsx`.
- `features/public/demo.ts` derives preview numbers from the shipped `mock/mock-data.json`, never from a visitor's workspace or database. Direct and recovered purchases remain separate and sum to the displayed total.
- The public forecast explicitly illustrates a 20% improvement assumption; it is labeled DEMO FORECAST and does not replace the App's calculation engine or promise results.
- DEMO DATA / DEMO CONNECTION / PLANNED labels distinguish examples, connection walkthroughs and future real integrations. No external API, OAuth, credentials or advertising requests were added.
- `PublicSession` reads only the same-origin Auth.js session endpoint to adapt entry links. The page itself and previews do not import Dashboard, WorkspaceBootstrap, GA4, Campaign or simulation client code.
- App CSS remains in the authenticated workspace layout; public and auth pages use the small shared base stylesheet, plus their own presentation styles.

## SEO and accessibility

Homepage title, description, canonical and OpenGraph metadata are in `app/page.tsx`. The canonical/OG origin uses the existing `AUTH_URL` origin. Set that existing environment variable to the deployed HTTPS service origin; no new environment variable or secret is needed. Local fallback is `http://localhost:3000`.

Authenticated pages and login/signup are noindex. Public sections have semantic headings, native links, an accessible skip link, visible keyboard focus, a native mobile navigation menu and reduced-motion support. Product previews are static examples rather than nonfunctional controls.

## Guard and security impact

`proxy.ts` treats only `/`, `/login` and `/signup` as public and adds `/dashboard` to its protected matcher. The route-to-permission mapping moves the existing VIEW_OWN_ADVERTISER requirement to `/dashboard`. DB-backed active-user checks, roles, Membership validation, query scope checks, Auth.js, Credentials, session invalidation, signup API, approval and tenant policies are unchanged. The existing CSP nonce is retained on public routes.

No schema, migration, production data, dependency, deployment workflow or Cloudtype configuration changes. This is nevertheless HIGH RISK because public-route boundaries and authentication entry paths changed. Commit and push remain pending explicit approval; no Actions/Cloudtype deployment is triggered by this local work.

## Validation

Use `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run test:ui`.

Playwright runs against an isolated local test database/server, with Mock connectors. It covers existing App regressions and public navigation, session-aware entry for all three roles, PENDING signup through `/signup`, protected routes, tenant isolation, metadata, local anchor targets, keyboard entry, external-request absence and 1440/1366/1024/768/390px layouts. Screenshots are local ignored artifacts in `test-results/public-*.png`.

The public browser test attaches `initial-javascript.json`, recording decoded initial script sizes for the homepage and dashboard. It asserts that the homepage loads less JavaScript. The production public client-reference manifest contains only the shared error boundary and `features/public/public-session.tsx` as application client modules; previews remain server-rendered.

Validated locally on 2026-09-21: TypeScript, ESLint, 68 unit tests and production build passed. All 67 existing browser regressions passed; after correcting URL normalization in the new canonical assertion and improving small-label contrast, all 3 public tests passed. The affected dashboard/auth/agency tests also passed after the final dashboard data-loading path correction. Five viewport checks include calculated text/background contrast (4.5:1 normal text, 3:1 large text), horizontal overflow, and screenshots.

Measured decoded initial JavaScript: public homepage **463,197 bytes**, dashboard **651,892 bytes**, approximately **29% less**. These are decoded resource sizes, not compressed transfer sizes or a Lighthouse score. Homepage-specific entry-link code is 875 bytes in this build; the rest is shared framework/error-boundary code.
