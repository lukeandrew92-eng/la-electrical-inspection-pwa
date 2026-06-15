# L.A Electrical Inspection Report Builder

Version: `final-v2-20260615`

Android Chrome / GitHub Pages compatible PWA for producing branded A4 Electrical Safety Check PDF reports for L.A Electrical Connections.

## Upload to GitHub Pages

1. Download and extract the ZIP.
2. Open the extracted folder.
3. Upload all files inside the folder to the root of your GitHub repository.
4. Commit changes to the `main` branch.
5. Go to **Settings > Pages**.
6. Set **Source** to `Deploy from a branch`.
7. Set **Branch** to `main` and folder to `/ root`.
8. Open the app URL with a cache-busting suffix, for example:
   `https://YOUR-USERNAME.github.io/la-electrical-inspection-pwa/?v=final-v2`

## Files expected in the repository root

- `index.html`
- `app.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- `README.md`
- `icon-192.png`
- `icon-512.png`
- `LAELECTRICAL-LOGO-2026-REBRAND-HORIZONTAL.png`
- `LAELECTRICAL-LOGO-2026-REBRAND-SYMBOL.png`
- `LAELECTRICAL-LOGO-2026-REBRAND-BLACK.png`

No `assets` folder is required.

## Clearing old Android Chrome / PWA cache

1. Remove the old app shortcut from your Android home screen.
2. Open Chrome.
3. Go to **Settings > Site settings > All sites**.
4. Search for `github.io`.
5. Tap your GitHub Pages site.
6. Tap **Clear & reset** / **Delete data**.
7. Reopen the app link with `?v=final-v2` at the end.
8. Add to home screen again.

Inside the app you can also open **Settings** and tap **Clear Local App Data + Caches**.

## Testing PDF export on Android Chrome

1. Start a new report.
2. Complete Job, Scope, Visual, Testing, RCD, Smoke and Sign.
3. Add a test photo if needed.
4. Go to Export.
5. Tap **Generate Client PDF**.
6. Save/share the generated `.pdf` file.
7. Open the PDF and check that it is A4, has black headers, correct logo usage, controlled footers, clean tables, and no random page splits.

The **Backup inspection data as JSON** section is only for app backup data. It is not the client PDF.
