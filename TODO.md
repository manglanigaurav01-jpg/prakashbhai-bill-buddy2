# Folder Structure Implementation for Mobile Local Storage

## Completed Tasks
- [x] Create `src/lib/filesystem-utils.ts` with folder management functions
- [x] Update `src/lib/pdf.ts` to save bill PDFs in customer-specific folders
- [x] Update `src/lib/pdf.ts` to save customer summary PDFs in customer-specific folders
- [x] Fix TypeScript errors in filesystem utilities

## Pending Tasks
- [ ] Test folder creation on mobile device
- [ ] Verify PDF saving in correct customer folders
- [ ] Handle filesystem permission errors gracefully
- [ ] Update bill creation flow to ensure customer folders are created when needed (if not already handled)
- [ ] Test fallback to CACHE directory when customer folder creation fails

## Implementation Details
- Customer names are sanitized (special chars removed, spaces to underscores, max 50 chars)
- PDFs are saved in DOCUMENTS directory under customer name folders
- Fallback to CACHE directory if customer folder creation fails
- Uses Capacitor Filesystem API for mobile operations

## Testing Checklist
- [ ] Create a bill and verify PDF saves in customer folder
- [ ] Generate customer summary and verify PDF saves in customer folder
- [ ] Test with special characters in customer names
- [ ] Test fallback behavior when filesystem access fails
- [ ] Verify sharing functionality works with saved PDFs
