# Kelvin De Moya

**Staff Engineer / Engineering Manager**  
Fully remote · EST

[Portfolio](https://kdemoya.github.io/me/) · [Printable profile](https://kdemoya.github.io/me/profile.html) · [Context for your agent](https://kdemoya.github.io/me/context.md)

I build APIs, content systems, and the teams behind them. Over **14+ years**, my work has spanned search reliability, permissions, platform architecture, mobile experiences, and AI-powered metadata.

At Wistia, I progressed from Senior Software Engineer II to Staff Software Engineer and Engineering Manager. I combine hands-on architecture and implementation with coaching, technical direction, and cross-team delivery.

> Make change observable and reversible. Give engineers room to own the work. Stay close enough to the implementation to help.

## 🛠️ Selected work

### Search that can check and repair itself

**Wistia** · Search reliability

I conceived and led sampled search-consistency monitoring and automated repair, supported by account-aware indexing, backfill tooling, and static-analysis guardrails. The result made search consistency something we could observe and maintain as the product changed. I also designed a reversible per-account migration that kept feature-flag checks out of the search request path.

### Private libraries inside a shared product

**Wistia** · Authorization and content systems

I led technical scoping and initial implementation for **My Library**, carrying private-content rules through authorization, queries, search, and APIs within an existing collaboration model. My work also included delivery of a limited-access Viewer role across permissions, provisioning, account limits, and user workflows.

### One GraphQL API across independently owned services

**Beachbody, through X-Team** · API architecture

I architected and led a federated GraphQL gateway in Node.js and TypeScript for web, Android, iOS, and Roku client teams. I also led the primary data API's migration from REST to GraphQL and introduced runtime caching to reduce repeated work against a complex upstream CMS.

### From hackathon prototype to self-service recovery

**Wistia** · Product delivery

I took a hackathon prototype into production so customers could recover deleted media, folders, and channels themselves.

### Making AI useful in everyday engineering

**Wistia** · Engineering practice and coaching

I helped engineers adopt AI through open demonstrations, individual coaching, and working prototypes, sharing what worked, what failed, and how I reviewed the results. In my own work, I use Claude Code and Codex across research, planning, and implementation while retaining responsibility for architecture, review, and validation.

## 💼 Experience

### Wistia

**May 2022–Present**

| Role                        | Dates                  |
| --------------------------- | ---------------------- |
| Engineering Manager         | March 2025–Present     |
| Staff Software Engineer     | August 2024–March 2025 |
| Senior Software Engineer II | May 2022–August 2024   |

- **Engineering Manager:** Coach senior and staff engineers, support growth planning, delegate initiative ownership, and guide technical direction while continuing hands-on implementation. Co-led content-management modernization and coordinated parallel work and cross-team dependencies. Designed and optimized an AI metadata platform and historical backfill.
- **Staff Software Engineer:** Owned backend integration and internal support tooling for multi-account workspaces across GraphQL, subscription validation, and reporting. Enabled a premium add-on while preserving free access for existing workspace customers. Owned search-personalization investigation through initial rollout and A/B-test foundations, and researched transcript-search feasibility and vendor constraints.
- **Senior Software Engineer II:** Led search integrity and migration work. Built content-organization and subfolder capabilities across asynchronous migration, GraphQL, React, bulk operations, uploads, navigation, and drag-and-drop.

### X-Team

**November 2015–April 2022**

**Lead Software Engineer — Beachbody**  
_Client assignment through X-Team_

- Led federated GraphQL architecture, the primary API's REST-to-GraphQL migration, and runtime caching for a complex upstream CMS.
- Re-architected core React surfaces to improve loading performance.

**Senior Software Engineer — Riot Games**  
_Client assignment through X-Team_

- Improved internal video-transcoding and localization pipelines.
- Built a React Native and Expo prototype later incorporated into production iOS and Android apps.

### Intellisys

**March 2012–October 2015**

**Software Engineer — Condé Nast**  
_Client assignment through Intellisys_

- Worked remotely with several Condé Nast magazines on a replatforming initiative, helping rebuild legacy web systems and shared functionality with Node.js and modern JavaScript.

## 🧰 Skills and practice

| Area                     | Tools and experience                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Languages and frameworks | Ruby, Ruby on Rails, TypeScript, JavaScript, Node.js, React, Next.js, SQL                                     |
| APIs and integration     | REST, GraphQL, federated gateways, CMS integration, subscription validation                                   |
| Search and reliability   | Algolia, account-aware indexing, sampled monitoring, automated repair, backfills, reversible migrations       |
| Content and access       | Multi-tenant SaaS, authorization, personal and shared libraries, content hierarchies                          |
| Delivery and operations  | Background processing, observability, static analysis, RuboCop, AWS Lambda, runtime caching, experimentation  |
| AI-assisted engineering  | Claude Code, Codex, parallel-agent coordination, research, planning, implementation, review, validation       |
| Mobile                   | React Native, Expo                                                                                            |
| Engineering leadership   | Coaching, growth planning, delegation, technical direction, cross-team delivery, hiring, technical interviews |

## 🎓 Education

**Associate Degree in Computer Information Systems**  
Pontificia Universidad Católica Madre y Maestra

## ✉️ Let's talk

For conversations about staff engineering or engineering management:

**[kdemoya17@gmail.com](mailto:kdemoya17@gmail.com)** · [LinkedIn](https://www.linkedin.com/in/kdemoya/)

Fully remote · EST

---

<details>
<summary>About this site / local development</summary>

### Local preview

This is a static HTML, CSS, and JavaScript site with no package installation or build step:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. The particle portrait has a static SVG fallback for reduced motion, unavailable JavaScript, or renderer failure. “Ask your agent about me” copies a short prompt linking to the public context file; it makes no model calls. The site has no backend, analytics, cookies, or API keys.

### Content and assets

- `index.html`: interactive portfolio; `profile.html`: printable profile.
- `profile.md` and `context.md`: professional content in Markdown; `404.html`: missing-page fallback.
- `assets/css/`, `assets/js/`, `assets/data/`, `assets/images/`, and `assets/fonts/`: styles, behavior, particle data, SVGs, and fonts.
- Keep career facts consistent across this README and the four profile documents. Update canonical URLs, social metadata, and structured data when public information changes.
- The agent prompt and public base URL live in `assets/js/agent.js`; particle behavior lives in `assets/js/particles.js`.

After editing `assets/data/portrait.js` or the shared `assets/js/portrait-style.js`, regenerate the static portrait:

```sh
node scripts/render-portrait.mjs
```

Fira Code and Space Grotesk are self-hosted under the SIL Open Font License; their licenses are in `assets/fonts/`. The monogram SVG retains its reference attribution. Generated portrait data and SVG geometry stay compact; other source uses two-space indentation.

### GitHub Pages

The public URL is **https://kdemoya.github.io/me/**. In repository settings, choose **Pages → Source → GitHub Actions**. [The deployment workflow](.github/workflows/pages.yml) publishes on pushes to `main` and supports manual runs. It stages public pages and assets, excluding repository documentation and generation scripts. Local asset links support the `/me/` project path.

</details>
