<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Responsive page layout

- Give sections their own spacing through a parent layout gap or an adjacent-section rule. Optional headings, notices and status messages must not provide the only gap between controls and content.
- Let button rows wrap and allow grid or flex children to shrink. Keep wide tables scrollable inside their own containers.
- When changing a page layout, verify desktop and narrow mobile widths with optional blocks both present and absent. For auction UI edits, regenerate the GitHub Pages bundle with `npm run build:pages-auction`.
