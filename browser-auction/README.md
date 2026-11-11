# GitHub Pages auction

This is the published browser-only entry point. No Vercel, Neon, database, API hosting or account is required. The existing Next.js implementation remains available as source for a possible future server version; GitHub Pages serves only the generated static files.

- Build: `node scripts/build-browser-auction.mjs` (React, React DOM, esbuild and Zod must be installed from the root package).
- Serve the repository root with a static HTTP server; open `/ipl-auction/`.
- Publish `ipl-auction/index.html`, `ipl-auction/auction.js`, and `ipl-auction/auction.css`, including the entire `ipl-auction/chunks/` directory alongside the existing website.
- Routes after `#` support dashboard, franchise selection, retention rooms and player details without server rewrites.
- Source components and the retention engine are shared with the original implementation. Build-time adapters replace only routing, local API calls and server-save copy.
- One compact localStorage record (`tcs-auction-latest-v1`) stores the latest team and decisions. New games replace that record only after valid creation. Refresh resumes it. Stats are reconstructed from public reference fixtures, never saved from client-provided salary values.
- This is a single-player fan simulation. Local validation prevents ordinary invalid actions, but browser saves can be edited by the device owner and are not authoritative competitive results.
- Clearing browser storage removes the save; private browsing may remove it when closed. No cross-device sync. Old local server saves are not migrated.
- Player references and coverage limitations are unchanged. 2027 rules/purse are custom assumptions. Download/share cards contain the full selected squad, not a private session URL.

Squad cards start collapsed, showing just the name and View stats. Opening mounts the details and fetches stats on demand through a separate JS chunk. Retain/Release and Undo are inside the expanded card. Missing data and source labels are preserved. The first stats request loads the shared stats chunk; later player lookups reuse it.
