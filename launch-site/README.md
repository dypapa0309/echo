# Echo Launch Site

This folder contains static pages for release support links.

## Files

- `index.html`
- `support.html`
- `privacy.html`
- `terms.html`

## Suggested Netlify deployment

Quick option:

1. Upload this folder to Netlify Drop
2. Keep the generated site URL or connect your own domain
3. Use the final URLs in app env vars

Repo deploy option:

1. Connect this repository to Netlify
2. Netlify will read `netlify.toml`
3. The deploy will publish `launch-site/` directly without running Expo web export

Example:

- `https://your-site.netlify.app/`
- `https://your-site.netlify.app/support`
- `https://your-site.netlify.app/privacy`
- `https://your-site.netlify.app/terms`

Netlify redirects for the clean routes are already included in `netlify.toml`.
