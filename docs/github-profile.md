# GitHub profile

The profile source is in [`github-profile/`](../github-profile/), and its published copy lives in [`kdemoya/kdemoya`](https://github.com/kdemoya/kdemoya). It carries the portfolio’s charcoal, cream, pink accent, and dotted K into a concise GitHub introduction. Career facts come from `profile.md` and `context.md`; the monogram retains its source attribution.

## Publish

GitHub displays a profile README from a **public repository whose name matches your username**. For this account, that is `kdemoya/kdemoya`, with `README.md` at the repository root. The full website lives separately in [`kdemoya/kdemoya.github.io`](https://github.com/kdemoya/kdemoya.github.io). Updating this website repository alone will not change the profile. See [GitHub’s profile README instructions](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme).

To publish updates, copy **the contents** of `github-profile/` into the root of `kdemoya/kdemoya`:

```text
kdemoya/kdemoya
├── README.md
└── assets
    ├── hero.svg
    └── hero-mobile.svg
```

Commit those three files to its default branch. Keep the `assets/` directory beside the README so the relative image paths work. The banners are self-contained SVGs; they need no scheduled workflow, third-party image service, or API credentials.

## Profile fields

Suggested bio:

```text
Staff Engineer / Engineering Manager. I build reliable systems and the teams behind them. 14+ years · Ruby, TypeScript, GraphQL · Fully remote, EST.
```

Website: <https://kdemoya.github.io/>

Pin [`kdemoya.github.io`](https://github.com/kdemoya/kdemoya.github.io) so visitors can explore the portfolio’s implementation.

## Editing

- Update the introduction and selected work in `github-profile/README.md`. Keep career facts aligned with `profile.md` and `context.md`.
- Edit colors, type, and layout in `scripts/render-github-profile.mjs`, then run `node scripts/render-github-profile.mjs` to regenerate both banners.
- The banner deliberately uses system fonts and embeds the K geometry. It does not depend on fonts loading inside GitHub’s image renderer.
- The README uses a `<picture>` element to select the mobile composition at viewport widths of 600px or less. All other content remains native, selectable Markdown/HTML, and the image has descriptive alt text.
- The charcoal banner works against both light and dark GitHub themes. The artwork is static and introduces no motion.

The generator and this guide belong to the portfolio repo; only the three files above are needed in the profile repo.
