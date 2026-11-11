# Direct squad-image sharing

The compact **Share your squad** button creates a card for retained players only and opens the device's native share sheet with one PNG file. It has no disclosure panel, scope selector, website image preview, text copy, WhatsApp shortcut or download control.

The card is prepared privately after the saved/optimistic squad snapshot changes. A signature prevents stale cards being shared; the existing keyed squad-tools component resets caches when choices change. The button is disabled while preparing and if no players are retained. No object URLs, preview images or download anchors are created.

Preparation must finish before clicking because Web Share requires transient user activation. The actual navigator.share call is made synchronously during the click handler, before awaiting anything. navigator.canShare checks the PNG payload first. The website opens the share sheet only; the user chooses the destination and confirms sharing.

A browser must support HTTPS Web Share with files and permit it in the current embedding context. Unsupported browsers receive a short status message, as requested, with no fallback controls. Cancel is quiet. Errors can be retried with the same Share your squad button. The destination apps listed are controlled by the device, not the website.

Tests cover synchronous native invocation, file-only payload (no private guest/session link), unsupported file sharing, cancellation and retry errors. Existing squad model tests cover retained-only scope. Browser QA can confirm controls and support handling; actual installed app destinations require testing on that device.
