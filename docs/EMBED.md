# StudyFlow HTML Embed

Use these files to embed the exact build-based HTML mode from any external page:

- public/studyflow-embed-iframe.html
- public/studyflow-embed-fetch.html

## Endpoints

- /html: loader-first page (always)
- /api/html/stream: live status events for loader progress
- /api/html/render: final exact built app HTML payload

## Target Query

Allowed values:

- /
- /dashboard
- /setup

Example:

- /html?target=%2Fdashboard

## Notes

- For maximum fidelity and fastest startup, run npm run build so stream/render can use build artifacts.
- If build artifacts are unavailable (common on serverless runtimes), stream/render automatically fall back to live route capture.
- CORS headers are enabled on html stream/render routes for cross-origin embedding.
- For highest fidelity and stable localStorage behavior, prefer iframe loading of /html.
- The fetch embed template now navigates the iframe to the final `/api/html/render` URL (instead of `srcdoc`) to avoid hydration/CSP issues that can leave the app on its initial loading spinner.
