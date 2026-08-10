# Audit: Outreach Checkout / Sign-Out — Decoupling Receipt Printing

## Verdict

Receipt printing does **not** block the database transaction — sign-out is committed before any PDF work starts. What it blocks is the **UI completion of the flow**: `openReceiptForPrint()` runs synchronously *before* the modal closes, and does three intrusive things at once — builds the PDF, opens a new browser tab, calls `window.print()`, and **force-downloads the file via `doc.save()`**. On outreach/mobile devices this reads as "checkout won't finish until you deal with the receipt".

## 1) UI / components / hooks in the outreach checkout path

| Layer | File | Role |
|---|---|---|
| Entry surface | `src/components/admin/OutreachAnalysisQueue.tsx` | "Checkout & Sign-Out" button (opens close modal) and "No Sale — Quick Close" (direct table update, no receipt) |
| Checkout modal | `src/components/admin/OutreachVisitCloseModal.tsx` | Outcome, recommendations, product cart, follow-up, notes; calls sign-out then prints |
| Cart | `src/components/admin/signout/SignOutCatalogPicker.tsx`, `SignOutCart.tsx` | Line-item capture |
| Mutation | `useSignOutClient` in `src/hooks/useClientVisits.ts` | Line-item persist + RPC + side effects |
| Support | `useVisitAssessment`, `useRealStaff`, `useCreateRealAppointment`, `useAuth` | Context for outcome + receipt content |
| Receipt | `src/lib/receiptPdf.ts` (`generateReceiptPdf`, `openReceiptForPrint`) | PDF build, new tab, auto-print, auto-download |
| Clinic (separate) | `src/components/admin/ClientSignOutModal.tsx` | Front-desk sign-out — same print behaviour |

## 2) RPC / payload

`useSignOutClient` →
- Pre-step: reads visit context, voids existing `active` `visit_line_items`, inserts new walk-in rows (skipped when plan-linked lines exist).
- `finalise_visit_signout(p_visit_id, p_collected, p_outcome, p_payment_state, p_notes, p_service_delivered, p_follow_up_required, p_next_appointment_recommended, p_treatment_completed, p_promo_code, p_manual_discount_type, p_manual_discount_value, p_manual_discount_reason)` — atomic, idempotent (returns `already_signed_out`).
- Post-step (skipped on replay): journey events, follow-up row, client status bump, notification.
- The outreach modal additionally creates a follow-up `appointments` row when the toggle is on.

## 3) Where printing is triggered

`OutreachVisitCloseModal.handleConfirmClose`, after a successful `signOut.mutateAsync`:

```text
toast.success('Outreach visit closed');
if (hasPurchase) openReceiptForPrint(buildReceiptOpts());   // <- blocking UX step
onClose(); onClosed?.();
```

`openReceiptForPrint` opens a tab, auto-prints, **and** calls `doc.save()` (forced download). The confirm button even relabels to "Confirm & Print Receipt". Nothing about the receipt is persisted or required — it is purely client-side rendering. Same pattern in `ClientSignOutModal` (line ~464).

## 4) Tables written during checkout

`client_visit_logs` (sign-out fields), `visit_line_items` (+ `visit_line_item_history` audit), `finance_entries` (via RPC when paid), `promo_code_redemptions` (when a code applies), inventory movement/event rows via product-sale triggers, `lead_journey_events`, `client_follow_ups`, `clients.status`, `notifications`/`notification_recipients`, `appointments` (optional follow-up), `operational_events` ledger. **No receipt/document table is written** — `document_deliveries` is not touched by this path.

## 5) Idempotency dependencies

All idempotency lives server-side (`finalise_visit_signout` returns `already_signed_out`; complimentary lines use an idempotency key; quick-close uses `.is('sign_out_time', null)`). Receipt generation has zero coupling to it — making printing optional cannot break financial, inventory or audit integrity.

## Proposed change (smallest safe)

1. In `OutreachVisitCloseModal`, remove the auto-`openReceiptForPrint` call from `handleConfirmClose`; close the modal immediately after the mutation resolves.
2. Replace it with a non-blocking affordance: a success toast action ("Print receipt") and/or a "Receipt" button on the closed-visit row, both reusing the existing `buildReceiptOpts()` payload.
3. Split `receiptPdf.ts` so download and print are separate: `downloadReceiptPdf()` (`doc.save`) and `printReceipt()` (open tab + print). Stop doing both at once. Keep `openReceiptForPrint` as a thin wrapper so no other call site breaks.
4. Relabel the confirm button to "Confirm Close" always, and drop the "Receipt is printed only when a product is sold" helper copy.
5. Optionally mirror the same decoupling in `ClientSignOutModal` (front desk) for consistency — call out if you want outreach-only scope.

No schema, RPC, or mutation changes.

## Table / function impact

| Object | Verdict |
|---|---|
| `client_visit_logs` | KEEP AS-IS |
| `visit_line_items`, `visit_line_item_history` | KEEP AS-IS |
| `finance_entries`, `promo_code_redemptions` | KEEP AS-IS |
| inventory movement/event tables | KEEP AS-IS |
| `lead_journey_events`, `client_follow_ups`, `clients`, `notifications`, `appointments` | KEEP AS-IS |
| `operational_events` | KEEP AS-IS |
| `finalise_visit_signout`, `add_complimentary_treatments`, `sign_in_client_v2` | KEEP AS-IS |
| `OutreachVisitCloseModal.tsx` | CHANGE |
| `src/lib/receiptPdf.ts` | CHANGE (split print vs download) |
| `OutreachAnalysisQueue.tsx` | CHANGE (optional post-close "Receipt" action) |
| `ClientSignOutModal.tsx` | VERIFY (same pattern; change only if you want parity) |
| `document_deliveries` | VERIFY (unused by this path — confirm no reporting expectation) |

## Duplicate / legacy paths

- **"No Sale — Quick Close"** in `OutreachAnalysisQueue` writes `client_visit_logs` directly, bypassing `finalise_visit_signout` — it produces no finance/ledger/journey rows. Legacy and worth consolidating later, but **leave alone** for this change.
- `OutreachVisitCloseModal` is documented in-code as "legacy" yet is the live checkout surface. **Keep** — it is the correct place for the fix.
- `ClientSignOutModal` is the clinic-side twin; do not merge them now.