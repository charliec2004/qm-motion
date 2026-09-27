# Trailhead storefront

The Trailhead web storefront: home page, product pages, and shared site chrome.

## Run

```sh
npm ci
npm run dev      # http://localhost:5173
npm run build
```

`vite` serves every path from `index.html`; routes live in `src/App.jsx`.

## Layout

- `src/main.jsx`: mounts the app.
- `src/App.jsx`: path-based routing.
- `src/pages/`: one component per page.
- `src/components/`: shared header and footer.
- `src/data/`: catalog and placeholder content.
- `src/styles/`: `tokens.css` (design tokens), `base.css`, and one stylesheet
  per page.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before adding a page.
