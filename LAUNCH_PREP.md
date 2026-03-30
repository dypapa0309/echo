# Echo Launch Prep

Echo v1 can be prepared for release before store review starts. This file keeps the launch work that does not depend on approval in one place.

## What Is Ready Now

- The app already reads:
  - `EXPO_PUBLIC_SUPPORT_EMAIL`
  - `EXPO_PUBLIC_PRIVACY_URL`
  - `EXPO_PUBLIC_TERMS_URL`
- Settings already shows:
  - support
  - privacy policy
  - terms of service
  - restore purchases
  - app version

## What To Deploy To Netlify

The `launch-site/` folder contains three static pages you can deploy as-is or copy into an existing Netlify site:

- `launch-site/index.html`
- `launch-site/support.html`
- `launch-site/privacy.html`
- `launch-site/terms.html`

Suggested final URLs:

- `https://<your-site>.netlify.app/`
- `https://<your-site>.netlify.app/support`
- `https://<your-site>.netlify.app/privacy`
- `https://<your-site>.netlify.app/terms`

If you want clean paths on Netlify, either:

1. Rename each page to `index.html` inside matching folders, or
2. Keep the filenames and use the direct `.html` URLs

This repo now includes `netlify.toml`, so repository deploys can publish `launch-site/` directly and still open:

- `/`
- `/support`
- `/privacy`
- `/terms`

## Environment Variables To Fill Before Release

```bash
EXPO_PUBLIC_SUPPORT_EMAIL=hello@yourdomain.com
EXPO_PUBLIC_PRIVACY_URL=https://<your-site>.netlify.app/privacy
EXPO_PUBLIC_TERMS_URL=https://<your-site>.netlify.app/terms
EXPO_PUBLIC_REVENUECAT_IOS_KEY=...
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=...
```

## Launch Assets To Finalize

- App icon
- App Store screenshots
- Subtitle
- Full description
- Keywords
- App Review Notes
- Privacy answers in App Store Connect

## Must Verify On Real iPhone

- Recording works from the home screen
- Floating recorder works from non-home screens
- Native STT succeeds at least once
- Calendar-linked memo succeeds at least once
- Delete, rename, and follow-up flows work
- Restore purchases button responds correctly

## Launch Decision

If native STT and calendar linking both succeed on a real iPhone, Echo is close to submission-ready for a first launch.
