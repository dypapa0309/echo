# Echo Submission Checklist

## Release Environment

- Set `EXPO_PUBLIC_SUPPORT_EMAIL`
- Set `EXPO_PUBLIC_PRIVACY_URL`
- Set `EXPO_PUBLIC_TERMS_URL`
- Set RevenueCat keys if billing is enabled

## Netlify

- Redeploy the site
- Verify `/`
- Verify `/ko`
- Verify `/support`
- Verify `/privacy`
- Verify `/terms`

## Real Device QA

- Record from the home screen
- Save and reopen a memo
- Play recorded audio
- Confirm native STT succeeds at least once
- Confirm calendar-linked memo succeeds at least once
- Rename and delete a memo
- Verify the follow-up flow
- Verify Restore Purchases in Settings

## App Store Connect

- Finalize screenshots
- Finalize subtitle and description
- Paste Support URL
- Paste Privacy Policy URL
- Paste App Review Notes

## Final Check

- Replace the landing page App Store button with the final App Store URL once the listing exists
- If real-device recording, STT, and reopen flows work, Echo is ready for TestFlight / submission
