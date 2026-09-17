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

Commit "feat(menu): force delete for products, categories and tables" @"
Deleting a sold product was refused, because order_items.product_id is a
foreign key with no cascade. That refusal was protecting the wrong thing. An
order line does not need its product row: it carries product_name_snapshot,
category_name_snapshot, unit_price_snapshot, station_snapshot and
revenue_line_snapshot, written at the moment of sale precisely so a later
rename, reprice or deletion can never rewrite what a customer was charged -
and every report on this system reads those snapshots.

V11 makes the FK ON DELETE SET NULL and the column nullable, so history keeps
every figure and stops pointing at a menu entry that is gone. The Java side
already expected this: OrderService and ShiftAuditService are full of
`if (item.getProduct() != null)`.

What is actually lost, and the dialog now says so: the product's
stock_adjustments go with it (they carry no snapshot, so a movement whose
product is gone can say nothing about what moved), along with its options and
recipe. Sales history survives; the inventory trail for that one product does
not. Deactivate remains the choice that loses nothing.

Categories and tables get the same treatment. products.category_id becomes ON
DELETE SET NULL rather than cascade - deleting a category must never be a way
to wipe a menu by accident, so the products survive and surface under
غير مصنّف, which the POS already groups. orders.table_id has been SET NULL
since V1, so a table needs no schema change; deleting one with a live order on
it is refused with a 409 that explains itself.
"@ @(
  "src/main/resources/db/migration/V11__force_delete_constraints.sql",
  "src/main/java/com/example/cafemangmentsystem/menu/ProductService.java",
  "src/main/java/com/example/cafemangmentsystem/menu/CategoryService.java",
  "src/main/java/com/example/cafemangmentsystem/menu/CategoryController.java",
  "src/main/java/com/example/cafemangmentsystem/menu/entity/Product.java",
  "src/main/java/com/example/cafemangmentsystem/cafetable/CafeTableService.java",
  "src/main/java/com/example/cafemangmentsystem/cafetable/CafeTableController.java",
  "src/main/java/com/example/cafemangmentsystem/order/entity/OrderItem.java",
  "src/main/java/com/example/cafemangmentsystem/order/dto/OrderItemResponse.java",
  "src/test/java/com/example/cafemangmentsystem/menu/ProductDeletionTest.java",
  "frontend/src/api/menuApi.js",
  "frontend/src/api/tablesApi.js",
  "frontend/src/pages/Products/ProductsPage.jsx",
  "frontend/src/pages/Categories/CategoriesPage.jsx",
  "frontend/src/pages/Tables/TablesPage.jsx"
)

Commit "feat(payroll): pay periods compute themselves; the manual reset is gone" @"
salaryPeriod was stored on every employee and consulted by nothing. The
summary took a start and an end date from the caller, applied that one window
to all staff, and handed each of them their full baseSalary regardless of how
wide it was - so a monthly employee shown in a seven-day view was reported as
owed a whole month for the week. isSettled was "is there any payout in the
caller's range", so last week's payout marked this week settled and the row
went green while the wage was still owed.

And "بدء أسبوع جديد وتصفية الحسابات" set settled = true on every unsettled
transaction up to a date while recording no payment at all. Pressed a day
early, it made money the cafe owed its staff disappear from the screen with
nothing left to say it had ever been owed.

Periods are now computed, not stored and not reset: PayrollPeriod.of(cycle,
anchor, date) derives the period containing a date from the employee's own
anchor date (V12; defaults to their hire date) plus their cycle. Nothing to
reset means nothing that can be reset at the wrong moment; no scheduler means
no rollover missed while the cafe is closed or the server is down; and asking
about a date in the past is the same calculation as asking about today, so old
payouts stay correctly attributed forever.

Weeks run from the anchor's weekday, not the calendar's - someone hired on a
Tuesday is paid Tuesday to Monday, which is what was agreed with them. Monthly
cycles clamp into short months without leaving a gap (a test pins that there is
no unpaid day between 31 Jan and 28 Feb; it also caught my first attempt at
the expectation being wrong).

Settled now means a payout dated inside that employee's own period - a fact,
not a flag someone can set by accident. The table shows each row's cycle and
window under the name, because two people on this screen can now legitimately
be looking at different periods.

resetWeek is removed from the service, the controller, the API client, the
handler, the button and its modal.
"@ @(
  "src/main/resources/db/migration/V12__payroll_anchor_date.sql",
  "src/main/java/com/example/cafemangmentsystem/employee/PayrollPeriod.java",
  "src/main/java/com/example/cafemangmentsystem/employee/EmployeePayrollService.java",
  "src/main/java/com/example/cafemangmentsystem/employee/EmployeePayrollController.java",
  "src/main/java/com/example/cafemangmentsystem/employee/entity/Employee.java",
  "src/main/java/com/example/cafemangmentsystem/employee/dto/WeeklyPayrollSummaryDto.java",
  "src/test/java/com/example/cafemangmentsystem/employee/PayrollPeriodTest.java",
  "src/test/java/com/example/cafemangmentsystem/employee/PayrollReceivablesPayablesTest.java",
  "frontend/src/api/employeesApi.js",
  "frontend/src/pages/Employees/EmployeesPage.jsx",
  "frontend/src/pages/Employees/EmployeesPage.css"
)

Commit "fix(pos): the onboarding tour could brick the screen it was explaining" @"
The tour is an 86%-black overlay across the whole viewport with pointer events
enabled. Its only exit was a button on a card, and the card placed itself by
reading each step's requested side literally against the target's own edges.

That works for a small target and fails completely for a big one. Step 1 asks
for "bottom" of .pos__tables - a FULL-HEIGHT panel - so the card landed twenty
pixels past the end of the screen. Step 4 asks for "top" of .shift-strip,
pinned to the top: same thing upwards. Two of the five steps put the only way
out of a blocking layer outside the window, and there was no Escape and no
click-to-dismiss. The app was unusable until someone cleared localStorage -
which is exactly what it looked like from the outside: an unexplained black box.

The card now measures its own height and clamps into the viewport, Escape ends
the tour, clicking the dim area ends it, and skip sits in the card header where
it does not move between steps.

While in here: the spotlight is a bordered box with a 9999px outward box-shadow
rather than a full-screen div wearing a ten-point clip-path polygon. Same
picture, rounded corners matching the panel, one rectangle instead of a polygon
string rebuilt every render, and no separate dimming layer that could paint over
the card. The card is opaque - it was --bg-card, rgba(17,19,26,.82), a
near-black translucent card over a near-black screen. Added a step counter, a
back button, titles, spotlight tracking on scroll (capture phase: the POS panels
scroll internally and never bubble to window), and prefers-reduced-motion.
"@ @(
  "frontend/src/components/OnboardingTour/OnboardingTour.jsx",
  "frontend/src/components/OnboardingTour/OnboardingTour.css"
)

Write-Host "=== after ==="""""
git log --oneline -6
git status --short

Write-Host ""
Write-Host "Nothing pushed. To push:  git push origin HEAD:master"
