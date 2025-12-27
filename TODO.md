# TODO: Fix Delete Error in Edit Payments and Edit Bills

## Issue Description
- When deleting "amt paid" in edit payment, shows error "failed to delete"
- Same error occurs in edit bill

## Root Cause
- `crypto.randomUUID()` in `recycle-bin.ts` is not supported in all browsers
- `deletePayment` and `deleteBill` call `addToRecycleBin`, which fails if UUID generation fails

## Changes Made
- [x] Import `uuid` package in `recycle-bin.ts`
- [x] Replace `crypto.randomUUID()` with `uuidv4()` in `addToRecycleBin` function

## Testing
- [ ] Test deleting payments in Edit Payments
- [ ] Test deleting bills in Edit Bills
- [ ] Verify items are properly moved to recycle bin

## Summary
The "Failed to delete" error was caused by `crypto.randomUUID()` not being supported in all browsers. The `deletePayment` and `deleteBill` functions call `addToRecycleBin`, which was failing due to the unsupported UUID method. This has been fixed by using the installed `uuid` package instead.

## Follow-up
- [ ] If issue persists, check for other potential causes (e.g., localStorage quota, JSON serialization issues)
