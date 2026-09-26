# pgcloud mobile app: architecture

Status: proposal, to start after the platform groups (G1 to G5) are finished.
Audience: founders and the first mobile engineer.

## 1. What DigitalOcean actually offers on mobile

DigitalOcean does not ship a first party mobile app. What people install is a set of third
party clients built on the public API, and DigitalOcean's own answer to "manage from my
phone" is the responsive web console plus email and Slack alerts. The feature set of the
popular third party apps is a good floor for what customers expect from a cloud on a phone:

| Area | What the third party apps do (Ocean, OceanNex, DropletManager, Digital Ocean Control) |
| --- | --- |
| Servers | List across projects, detail page, live stats (CPU, memory, disk, bandwidth), power on and off, reboot, rename, reset root password, resize, snapshot, destroy, create a new server |
| Databases | Cluster info, browse across projects, destroy |
| Load balancers | View, detach a server, remove a forwarding rule |
| Apps | View, live build and runtime logs |
| Domains | View and edit records |
| Volumes | View, resize, detach |
| Backups and snapshots | List, take a snapshot |
| Account | API token login, project switching, dark mode, open the web console |
| Alerts | Not in the apps; DigitalOcean's monitoring sends email and Slack |
| Billing | Read only at best; payments go through the web console |

Two gaps stand out. None of these apps receive push notifications from the platform because a
third party cannot subscribe to a customer's alerts, and none can approve anything because
there is nothing to approve on DigitalOcean. Both are things only a first party app can do, and
both are where pgcloud's agent story gives the app a reason to exist beyond "reboot from the
bus".

## 2. What the pgcloud app is for

The app is the pocket half of the console, not a copy of it. It is for the moments a
customer is away from a laptop:

1. **Something fired.** A push arrives for a CPU or disk alert, a failed deploy, a stopped
   server, a failed payment. The customer opens the incident, sees the graph, reboots or
   resizes, and mutes the rule if it is noise.
2. **An agent wants permission.** Claude, Cursor or n8n asked to resize down, rebuild, delete,
   or spend beyond the cap. The customer gets a push, sees exactly what was requested, and
   approves with a fingerprint or face. This is the headline feature.
3. **Quick checks.** Is everything green, what does this month cost so far, did the deploy
   finish, what is the IP of that server.
4. **Small fixes.** Power actions, snapshot, attach a volume, mute an alert, top up credit,
   pay an invoice.

Creating servers from the phone is supported but secondary; the console and the agents create
most resources.

## 3. Feature map

Every screen maps to endpoints the API already has. Rows marked "new" need API work, listed
in section 6.

| Screen | Content and actions | API |
| --- | --- | --- |
| Sign in | Email and password, TOTP step, biometric unlock after first sign in, team switch | `/auth/login`, `/auth/totp/*`, `/v1/me`, new device registration |
| Home | Health strip (firing alerts, pending approvals, failed deploys), month to date spend in the team currency, recent activity | `/v1/alerts/incidents?open=true`, `/v1/approvals?status=pending`, `/v1/deploys`, `/v1/billing/usage`, `/v1/events` |
| Approvals | Pending requests with the agent's summary and payload, approve or deny with biometric confirmation, history | `/v1/approvals`, `/approve`, `/deny` |
| Servers | List with status and IP, search, filter by project and tag | `/v1/servers` |
| Server detail | Overview (IP, size, image, region, price), Metrics (1h to 30d, four charts), Power (start, stop, reboot, resize), Networking (IPs, firewalls), Snapshots, Volumes, Activity | `/v1/servers/:id`, `/metrics`, `/actions`, `/v1/firewalls`, `/v1/snapshots`, `/v1/volumes?server=` |
| Monitoring | Firing incidents, rules with mute and enable, rule history | `/v1/alerts`, `/v1/alerts/incidents` |
| Deploys | List, status, live logs, redeploy | `/v1/deploys`, `/:id/logs` |
| Volumes | List, attach, detach, grow, delete | `/v1/volumes/*` |
| Load balancers, DNS, buckets | Read and the small actions once G3 to G5 ship | G3 to G5 endpoints |
| Billing | Balance, month to date, invoices, pay an invoice, top up credit, download PDF | `/v1/billing/*`, checkout in a browser sheet |
| Settings | Notification preferences per event class, biometric lock, language (EN, TR, AR with RTL), team switch, sign out everywhere | new `/v1/me/devices`, `/v1/me/notification-preferences` |

Out of scope for the first release: creating firewalls and rules, SSH keys, API tokens,
GitHub connection, team member management, the back office. These stay in the console.

## 4. Technology choice

**Recommendation: React Native with Expo, TypeScript, one codebase for iOS and Android.**

Why this and not native Swift and Kotlin, or Flutter:

- The team and the codebase are TypeScript. The console, the SDK, the MCP server and the
  OpenAPI types are all TypeScript; the app reuses `packages/sdk-ts` as its data layer and
  the generated types stay in sync with the API on every build.
- One engineer can ship both stores. Native would need two people or twice the time; the app's
  screens are lists, forms and charts, which is where React Native is strong and native gains
  nothing visible.
- Expo removes the parts that eat weeks: build signing (EAS Build), over the air updates for
  copy and bug fixes without a store review (EAS Update), push tokens (expo-notifications),
  secure storage, biometrics, deep links.
- RTL for Arabic and the three languages already exist in `apps/console/src/lib/i18n.ts`; the
  dictionaries move to a shared package.

Stack inside the app:

| Concern | Choice |
| --- | --- |
| Framework | Expo SDK (latest stable), React Native, TypeScript, Expo Router for file based navigation and deep links |
| Data | `@pgcloud/sdk` (packages/sdk-ts) wrapped in TanStack Query for caching, polling and background refetch |
| State | TanStack Query for server state, a small Zustand store for session, team and preferences |
| UI | React Native core components with a small design system that mirrors the console tokens (neutral scale, blue accent, amber second series); no heavy UI kit |
| Charts | Reuse the console's SVG chart logic through `react-native-svg`; same colors validated for light and dark |
| Auth storage | `expo-secure-store` (Keychain and Keystore) for the session token and refresh token |
| Biometrics | `expo-local-authentication` to unlock the app and to confirm approvals and destructive actions |
| Push | `expo-notifications` for tokens and display; server sends through APNs and FCM |
| Payments | `expo-web-browser` auth session to open the Stripe or iyzico checkout page, then a deep link back |
| Logs | Poll `GET /v1/deploys/:id/logs` with a cursor; an SSE stream can replace it later |
| i18n | Shared `packages/i18n` extracted from the console dictionaries; `I18nManager.forceRTL` for Arabic |
| Testing | Jest and React Native Testing Library for screens, Maestro flows on a simulator against the fake driver stack in CI |
| Builds | EAS Build for signed binaries, EAS Submit to both stores, EAS Update for JS only fixes |

## 5. System architecture

```
   phone                              pgcloud API                      platform
 ┌───────────────┐   HTTPS (bearer)  ┌──────────────────┐   NATS      ┌────────────┐
 │ Expo app      │ ────────────────► │ NestJS /v1        │ ◄───────── │ host agent │
 │  sdk-ts       │                   │  iam, compute,    │             └────────────┘
 │  TanStack Q   │ ◄──────────────── │  monitoring, ...  │
 │  secure store │   JSON            │                   │
 └──────▲────────┘                   │  notifications    │   push jobs  ┌────────────┐
        │  push                      │  module (new)     │ ───────────► │ APNs / FCM │
        └─────────────────────────── │                   │              └────────────┘
                                     └──────────────────┘
```

Flow for the headline feature, approving an agent request:

1. An agent token calls `DELETE /v1/servers/:id`. ApprovalsService parks it and emits
   `approval.requested`.
2. The new notifications module listens to that event, looks up the team's registered
   devices whose owner may approve, and sends a push with the approval id, the agent's
   summary and a category `approval`.
3. The phone shows the notification with Approve and Deny action buttons. Either opens the
   app on the approval screen (deep link `pgcloud://approvals/:id`) and asks for biometrics
   before calling `/approve` or `/deny`.
4. The API executes the parked action as the approver and the agent's next poll of
   `get_approval` sees the decision. The push that confirms completion closes the loop.

Push classes and their sources, all already emitted as events:

| Class | Events | Default |
| --- | --- | --- |
| Approvals | approval.requested, approval.expired | on, cannot be turned off for owners |
| Alerts | alert.fired, alert.resolved | on |
| Servers | server.failed, server.stopped by the platform, abuse hold | on |
| Deploys | deploy.failed, deploy.succeeded | failed on, succeeded off |
| Billing | payment.failed, invoice.issued, credit low | on |
| Security | login from a new device, TOTP enabled or disabled, token created | on |

## 6. API changes the app needs

All small, and all useful to the web console too.

1. **Device registration.** `POST /v1/me/devices { platform, pushToken, name, appVersion, locale }`,
   `DELETE /v1/me/devices/:id`, `GET /v1/me/devices`. New `Device` model: userId, teamId,
   platform, pushToken (unique), name, lastSeenAt, preferences JSON.
2. **Refresh tokens.** Sessions live 24 hours today. Add `POST /auth/refresh` with a rotating
   refresh token bound to the device (60 days, revoked on sign out everywhere or password
   change). The app never asks for the password again; biometrics gate the app, not the token.
3. **Notifications module.** Subscribes to EventsService the same way webhooks do, fans out to
   devices, sends through APNs (token based auth, HTTP/2) and FCM (HTTP v1), records
   deliveries and prunes tokens the providers reject. Preferences per device and per class.
4. **Notification preferences.** `GET`/`PUT /v1/me/notification-preferences`.
5. **Approval push categories.** Include `approvalId`, `kind`, `summary` and `expiresAt` in the
   payload so the notification renders without a fetch.
6. **Server list summary.** `GET /v1/servers?fields=summary` returning status, IP, size and
   the last CPU sample so the list screen loads in one call.
7. **Events feed.** `GET /v1/events?limit=50` for the home activity list, from AuditLog.
8. **SSE for deploy logs** (later): `GET /v1/deploys/:id/logs/stream`.

## 7. Security model

- Tokens live only in the secure enclave store; nothing in AsyncStorage.
- The app locks after 2 minutes in the background; unlocking needs biometrics or the device
  passcode. Approve, deny, delete, rebuild, resize down and top up always ask again.
- Certificate pinning against the API's leaf and intermediate, with a remote kill switch in
  EAS Update in case of a certificate rotation mistake.
- Push payloads carry ids and summaries, never secrets or IPs.
- A device that fails biometrics five times signs out and revokes its refresh token.
- Rate limits stay as they are; the app's refresh flow keeps it under 600 requests a minute
  with background refetch every 30 seconds on the home screen and 60 seconds elsewhere.
- Store requirements: cloud infrastructure billed outside the app is exempt from in app
  purchase rules on both stores, so Stripe and iyzico checkout can open in a browser sheet.
  Keep top up and invoice payment on web pages, never a native purchase flow.

## 8. Repository layout

```
apps/mobile/
  app/                    Expo Router screens: (auth)/, (tabs)/home, servers/[id], approvals/[id], ...
  components/             charts, status badge, list rows, approval card
  lib/                    api client (sdk wrapper), session store, push registration, biometrics
  locales/                re-exported from packages/i18n
  app.json, eas.json
packages/i18n/            dictionaries shared by console and mobile
packages/sdk-ts/          already exists; the app's only network layer
apps/api/src/modules/notifications/   device registration, push providers, preferences
```

CI adds a `mobile` job: typecheck, Jest, and an EAS preview build on pull requests that touch
`apps/mobile`. Releases go through EAS Submit from a tag.

## 9. Delivery plan

| Step | Scope | Effort |
| --- | --- | --- |
| M1 API groundwork | Device model, refresh tokens, notifications module with APNs and FCM, preferences, events feed | 2 weeks |
| M2 App skeleton | Expo project, sign in with TOTP, biometric lock, team switch, home, servers list and detail with metrics and power actions, i18n and RTL | 3 weeks |
| M3 Push and approvals | Device registration, push classes, approval screen with action buttons, alerts and incidents screens with mute | 2 weeks |
| M4 Everything else | Deploys with logs, volumes, billing with checkout sheet, settings, dark mode, screenshots and store listings in EN, TR and AR | 3 weeks |
| M5 Release | TestFlight and Play internal track, Maestro flows in CI, store review, OTA channel | 1 week |

About eleven weeks for one engineer who knows React Native, with the API work done by the
platform team in parallel during M1 and M2. Load balancers, DNS and object storage screens are
added as read plus small actions once G3 to G5 exist, a few days each.

## 10. What makes it better than the DigitalOcean experience

| | DigitalOcean on a phone | pgcloud app |
| --- | --- | --- |
| Who ships it | Third parties on the public API | First party, same team as the console |
| Alerts | Email and Slack; nothing on the phone | Push with the graph one tap away, mute from the notification |
| Agent actions | Nothing to approve | Approve or deny agent requests with biometrics |
| Billing | Read only | Balance, invoices, pay and top up in TRY or USD |
| Languages | English | English, Turkish, Arabic with RTL |
| Sign in | Paste an API token | Email, TOTP, then biometrics; sign out everywhere |
| Deploy logs | Some apps show App Platform logs | Live logs for Git Deploy, redeploy from the phone |

## Sources

Feature lists were compiled from the store listings and community pages of the third party
DigitalOcean clients: Digital Ocean Mobile (Ocean) on the App Store and Google Play, OceanNex
for Android, DropletManager (open source, Kotlin), and Digital Ocean Control for iOS.
