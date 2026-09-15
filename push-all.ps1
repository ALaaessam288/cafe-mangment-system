# Commits this session's work, then stops before pushing.
#
# Paths are listed explicitly: `git add -A` here stages ~35 files that differ only by CRLF line
# endings, which buries the real change. Any commit whose files are missing or unchanged is
# skipped, so re-running this after some of it has already landed is safe.
#
# Run from:  E:\...\initialize_frontend_worktree
# Usage:     powershell -ExecutionPolicy Bypass -File .\push-all.ps1

$ErrorActionPreference = 'Stop'

function Commit($subject, $body, $paths) {
    $existing = $paths | Where-Object { Test-Path $_ }
    if ($existing.Count -eq 0) { Write-Host "skip (no files): $subject"; return }

    git add -- $existing
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host "skip (nothing staged): $subject"; return }

    git commit -m $subject -m $body `
        -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" `
        -m "Claude-Session: https://claude.ai/code/session_011kus58xPhQXdGS9FepA5fY"
    Write-Host "committed: $subject"
}

Write-Host "=== before ==="
git status --short

Commit "fix(pos): a new product was invisible, and the group badge counted the wrong thing" @"
The menu grid buckets products by walking the CATEGORIES, not the products.
The 20s poll refreshed only the products, so a product in a category created
after the screen loaded had no bucket to be drawn in and sat invisible until a
reload. Any product whose category was missing from the list was dropped
entirely. And the group badge counted categories, so مشروبات read "1" while
the grid drew two drinks.

Categories and products are now read together, an unclaimed product lands
under أخرى / غير مصنّف, and the badge counts products.
"@ @(
  "frontend/src/pages/POS/menuGroups.js",
  "frontend/src/pages/POS/CategoryBar.jsx"
)

Commit "feat(products): real delete, and a delete that tells the truth" @"
ProductService.delete caught any exception and deactivated instead, reporting
success either way - and could not have worked anyway, since a constraint
violation marks the transaction rollback-only. menuApi did the same on the
client with .catch(() => deactivate).

It now asks first: order_items and stock_adjustments reference products with
no cascade, so if either exists the delete is refused with 409 and an
explanation. Otherwise the product goes with its options and recipe. The UI
gets a delete button behind a confirmation that offers deactivate as the way
out. Three tests pin the contract.
"@ @(
  "src/main/java/com/example/cafemangmentsystem/menu/ProductService.java",
  "src/main/java/com/example/cafemangmentsystem/order/repository/OrderItemRepository.java",
  "src/main/java/com/example/cafemangmentsystem/inventory/repository/StockAdjustmentRepository.java",
  "src/test/java/com/example/cafemangmentsystem/menu/ProductDeletionTest.java",
  "frontend/src/pages/Products/ProductsPage.jsx",
  "frontend/src/api/menuApi.js"
)

Commit "fix(pos): the supervisor PIN dialog was unusable below the fold" @"
The modal had no height cap, so on any screen shorter than its content the
footer - and the confirm button with it - was unreachable, and nothing
scrolled. The PIN display always drew six dots for a code that is 4 to 8
digits. And with no text input in the dialog, a keyboard could not drive it at
all; digits, Backspace, Enter and Escape now work, claimed in the capture
phase so they stop reaching the POS multiplier behind it.
"@ @(
  "frontend/src/components/SupervisorApprovalModal/SupervisorApprovalModal.jsx",
  "frontend/src/components/SupervisorApprovalModal/SupervisorApprovalModal.css"
)

Commit "feat(pos): void without a supervisor PIN" @"
The PIN gate cost more than it bought: the cashier is the person who spotted
the mistake, and fetching a supervisor for every wrong tap means the PIN ends
up known at the register anyway. Both void paths now open one confirmation
that states, in numbers, what is about to disappear.

Given up, plainly: no second person approves a void, and the cashier's chosen
reason is no longer recorded. Who voided what, and when, still is.
"@ @(
  "frontend/src/components/ConfirmVoidModal/ConfirmVoidModal.jsx",
  "frontend/src/components/ConfirmVoidModal/ConfirmVoidModal.css"
)

Commit "refactor(pos): give the menu the screen, and say the status in words" @"
The table picker collapses once a table is chosen, with a badge above the menu
keeping the choice visible. Status is spoken, not coloured: tableStatus.js
maps the backend states to فاضية / مفتوحة / في المطبخ / جاهزة / مستنية الحساب
with the age beside them, and the grid and badge both read from it.

A sticky checkout bar carries the item count, the total and تحصيل ودفع; when
payment is not allowed the button is disabled and says why instead of
vanishing. The five shift tools move behind one إدارة الشيفت menu, with قفل
الشيفت last, separated and red. F4 collects, F9 sends.

Found by looking at the running till: the shift strip was overflow-x: auto, so
the new dropdown was clipped to a 48px band and looked dead; and the collapsed
table rail never got narrow, because a themed width later in the stylesheet at
equal specificity beat it.

The ticket column was compacted - chips instead of three adjustment rows, an
icon row instead of three full-width buttons, no subtotal line when nothing
separates it from the total, and no grand-total line because the sticky bar
already prints it and never scrolls away. Targets stay at 44px.

No backend call, permission, calculation, inventory deduction or payment rule
changed. vite build succeeds; oxlint exits 0.
"@ @(
  "frontend/src/pages/POS/POSPage.jsx",
  "frontend/src/pages/POS/POSPage.css",
  "frontend/src/pages/POS/MenuPanel.jsx",
  "frontend/src/pages/POS/TableGrid.jsx",
  "frontend/src/pages/POS/OrderPanel.jsx",
  "frontend/src/pages/POS/ShiftStrip.jsx",
  "frontend/src/pages/POS/OrderContextBar.jsx",
  "frontend/src/pages/POS/tableStatus.js"
)

Commit "fix(invoices): every date on this screen was Invalid Date, and the filters knew it" @"
The page read o.createdAt in eleven places. OrderResponse has no such field -
it carries openedAt. So every date was new Date(undefined).

The visible half was "Invalid Date" on every card. The invisible half is
worse: the اليوم / أمس / آخر 7 أيام filters compared against Invalid Date, and
every comparison with it is false, so those filters silently matched nothing;
and NEWEST / OLDEST sorted on NaN, so they did nothing at all. This screen has
been unsorted and unfilterable by date for as long as the code existed.

One orderDateOf() now answers the question, with createdAt kept as a fallback.

Separately, the cards: the grid is flex:1 in a full-height column and a grid's
default align-content is stretch, so a single row of results grew to the whole
viewport and each card became a ~650px tower with a void in the middle - the
card's own space-between pushing header and footer apart. The cards were never
designed tall; the grid made them tall. align-content: start fixes it.
"@ @(
  "frontend/src/pages/Invoices/InvoicesPage.jsx",
  "frontend/src/pages/Invoices/InvoicesPage.css"
)

Write-Host "=== after ===""
git log --oneline -6
git status --short

Write-Host ""
Write-Host "Nothing pushed. To push:  git push origin HEAD:master"
