# Share Plugin Fixes

## Tasks to Complete
- [x] Fix generateBillPDFForceShare() in src/lib/pdf.ts - Remove data URL usage, implement proper file write/share pattern
- [x] Fix generatePendingPDF() in src/lib/pdf.ts - Remove data URLs from forceShare and fallback blocks
- [x] Fix generateAdvancePDF() in src/lib/pdf.ts - Remove data URLs from forceShare and fallback blocks
- [x] Fix createBackup() in src/lib/backup.ts - Change getUri to use Directory.Cache instead of Directory.Documents

## Verification Steps
- [x] Verify all Share.share() calls use file URIs from Directory.Cache
- [ ] Test sharing functionality on Android
