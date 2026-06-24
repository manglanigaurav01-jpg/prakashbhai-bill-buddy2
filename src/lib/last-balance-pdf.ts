import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlyBalance, Bill, Payment } from '@/types';
import { startOfMonth, endOfMonth, subMonths, format, parse } from 'date-fns';
import { generateMonthlyBalances } from './monthly-balance';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { getBillsByCustomer, getPayments } from './storage';
import { getPdfLineSettings } from './pdf-line-settings';
import { parseStoredDateToLocal } from './stored-date';
// Note: Worker is used for heavy PDF generation on web

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const formatPdfDate = (date: Date | string) => (
  format(typeof date === 'string' ? parseStoredDateToLocal(date) : date, 'dd-MM-yyyy')
);
const sanitizeFilePart = (value: string) => value.replace(/[\\/:*?"<>|]/g, '').trim();
const dayMonthShortYear = (date: Date) => format(date, 'dd-MMM-yyyy');

const formatPdfNumber = (value: number) => (
  Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/\.?0+$/, '')
);

const formatPdfAmount = (value: number) => `Rs. ${value.toFixed(2)}`;

const addCenteredPdfLine = (doc: jsPDF, text: string, y: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(15);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(170, 35, 35);
  doc.text(text, pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
};

const addPdfHeaderTagline = (doc: jsPDF, y: number = 20) => {
  const { headerLine } = getPdfLineSettings();
  const lines = headerLine.replace(/\r\n/g, '\n').split('\n').slice(0, 3);
  let lineY = y;
  lines.forEach((line) => {
    if (line.trim()) {
      addCenteredPdfLine(doc, line, lineY);
      lineY += 6;
    }
  });
};

const addPdfFooterLines = (doc: jsPDF, centerX?: number) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const x = centerX ?? (doc.internal.pageSize.getWidth() / 2);
  const { footerLine } = getPdfLineSettings();
  const lines = footerLine.replace(/\r\n/g, '\n').split('\n').slice(0, 3).filter((line) => line.trim());
  if (lines.length === 0) return;

  const baseY = pageHeight - (lines.length - 1) * 6 - 12;
  lines.forEach((line, index) => {
    doc.setFontSize(15);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(170, 35, 35);
    doc.text(line, x, baseY + index * 6, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  });
};

type LastBalanceSalesRow = {
  salesSrNo: string;
  salesDate: string;
  itemName: string;
  salesNote: string;
  quantity: string;
  rate: string;
  totalAmount: string;
};

type LastBalancePaymentRow = {
  paymentSrNo: string;
  paymentDate: string;
  paymentNote: string;
  amountPaid: string;
};

const buildLastBalanceTableRows = (
  bills: Bill[],
  payments: Payment[],
  openingBalance?: number
) => {
  const salesRows: LastBalanceSalesRow[] = [];
  const paymentRows: LastBalancePaymentRow[] = [];
  let totalSales = 0;
  let totalPaid = 0;
  let salesSrNo = 1;

  if (typeof openingBalance === 'number' && openingBalance !== 0) {
    salesRows.push({
      salesSrNo: '',
      salesDate: '',
      itemName: 'Last Month Closing Balance',
      salesNote: '',
      quantity: '',
      rate: '',
      totalAmount: formatPdfAmount(openingBalance)
    });
    totalSales += openingBalance;
  }

  [...bills]
    .sort((a, b) => parseStoredDateToLocal(a.date).getTime() - parseStoredDateToLocal(b.date).getTime())
    .forEach((bill) => {
      bill.items.forEach((item, itemIndex) => {
        salesRows.push({
          salesSrNo: itemIndex === 0 ? String(salesSrNo) : '',
          salesDate: itemIndex === 0 ? formatPdfDate(bill.date) : '',
          itemName: item.itemName,
          salesNote: itemIndex === 0 ? (bill.particulars || '') : '',
          quantity: formatPdfNumber(item.quantity),
          rate: formatPdfNumber(item.rate),
          totalAmount: formatPdfAmount(item.total)
        });
      });

      totalSales += bill.grandTotal;
      salesSrNo += 1;
    });

  [...payments]
    .sort((a, b) => parseStoredDateToLocal(a.date).getTime() - parseStoredDateToLocal(b.date).getTime())
    .forEach((payment, index) => {
      paymentRows.push({
        paymentSrNo: String(index + 1),
        paymentDate: formatPdfDate(payment.date),
        paymentNote: payment.note || '',
        amountPaid: formatPdfAmount(payment.amount)
      });
      totalPaid += payment.amount;
    });

  return { salesRows, paymentRows, totalSales, totalPaid };
};

interface CustomerLedgerPdfOptions {
  fromDate?: Date;
  toDate?: Date;
  mode?: 'share' | 'save';
}

export const generateCustomerLedgerPDF = async (
  customerId: string,
  customerName: string,
  options: CustomerLedgerPdfOptions = {}
) => {
  const fromDate = options.fromDate ? new Date(options.fromDate) : null;
  const toDate = options.toDate ? new Date(options.toDate) : null;
  if (fromDate) fromDate.setHours(0, 0, 0, 0);
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const allBills = (await getBillsByCustomer(customerId)).sort(
    (a, b) => parseStoredDateToLocal(a.date).getTime() - parseStoredDateToLocal(b.date).getTime()
  );
  const allPayments = getPayments()
    .filter((p) => p.customerId === customerId)
    .sort((a, b) => parseStoredDateToLocal(a.date).getTime() - parseStoredDateToLocal(b.date).getTime());

  const hasRange = Boolean(fromDate || toDate);
  const isInRange = (value: string) => {
    const d = parseStoredDateToLocal(value).getTime();
    if (fromDate && d < fromDate.getTime()) return false;
    if (toDate && d > toDate.getTime()) return false;
    return true;
  };

  const bills = hasRange ? allBills.filter((b) => isInRange(b.date)) : allBills;
  const payments = hasRange ? allPayments.filter((p) => isInRange(p.date)) : allPayments;

  let openingBalance = 0;
  if (hasRange && fromDate) {
    const previousBills = allBills
      .filter((b) => parseStoredDateToLocal(b.date).getTime() < fromDate.getTime())
      .reduce((sum, b) => sum + b.grandTotal, 0);
    const previousPayments = allPayments
      .filter((p) => parseStoredDateToLocal(p.date).getTime() < fromDate.getTime())
      .reduce((sum, p) => sum + p.amount, 0);
    openingBalance = previousBills - previousPayments;
  }

  const doc = new jsPDF({ orientation: 'landscape' });
  addPdfHeaderTagline(doc, 14);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(customerName, 20, 34);
  doc.setFontSize(14);
  doc.text('Customer Ledger Report', 20, 44);

  let rangeText = 'Date Range: All Entries';
  if (fromDate || toDate) {
    rangeText = `Date Range: ${fromDate ? format(fromDate, 'dd/MM/yyyy') : 'Start'} to ${toDate ? format(toDate, 'dd/MM/yyyy') : 'End'}`;
  }
  doc.setFontSize(12);
  doc.text(rangeText, 20, 54);
  doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy')}`, 20, 61);

  const { salesRows, paymentRows, totalSales, totalPaid } = buildLastBalanceTableRows(
    bills,
    payments,
    undefined
  );

  const periodClosingBalance = openingBalance + totalSales - totalPaid;
  const salesRowsWithBalances: LastBalanceSalesRow[] = [
    {
      salesSrNo: '',
      salesDate: '',
      itemName: 'Opening Balance',
      salesNote: '',
      quantity: '',
      rate: '',
      totalAmount: formatPdfAmount(openingBalance),
    },
    ...salesRows,
    {
      salesSrNo: '',
      salesDate: '',
      itemName: 'Closing Balance',
      salesNote: '',
      quantity: '',
      rate: '',
      totalAmount: formatPdfAmount(periodClosingBalance),
    },
  ];

  const maxRows = Math.max(salesRowsWithBalances.length, paymentRows.length, 1);
  const tableData = Array.from({ length: maxRows }, (_, index) => [
    salesRowsWithBalances[index]?.salesSrNo ?? '',
    salesRowsWithBalances[index]?.salesDate ?? '',
    salesRowsWithBalances[index]?.itemName ?? '',
    salesRowsWithBalances[index]?.salesNote ?? '',
    salesRowsWithBalances[index]?.quantity ?? '',
    salesRowsWithBalances[index]?.rate ?? '',
    salesRowsWithBalances[index]?.totalAmount ?? '',
    paymentRows[index]?.paymentSrNo ?? '',
    paymentRows[index]?.paymentDate ?? '',
    paymentRows[index]?.paymentNote ?? '',
    paymentRows[index]?.amountPaid ?? ''
  ]);

  autoTable(doc, {
    head: [['Sr Number', 'Date', 'Item', 'Note', 'Quantity', 'Rate', 'Total Amt', 'Sr Number', 'Payment Date', 'Note', 'Amt Paid']],
    body: tableData,
    startY: 69,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.8, valign: 'middle' },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [200, 200, 200], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 32 },
      3: { cellWidth: 28 },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 12, halign: 'center' },
      8: { cellWidth: 24, halign: 'center' },
      9: { cellWidth: 24 },
      10: { cellWidth: 20, halign: 'right' }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Sales (Selected Range): Rs. ${totalSales.toFixed(2)}`, 20, finalY);
  doc.text(`Total Paid (Selected Range): Rs. ${totalPaid.toFixed(2)}`, 20, finalY + 8);
  doc.setTextColor(255, 0, 0);
  doc.text(`Closing Balance: ${formatPdfAmount(periodClosingBalance)}`, 20, finalY + 16);
  doc.setTextColor(0, 0, 0);
  addPdfFooterLines(doc);

  const pdfOutput = doc.output('arraybuffer');
  const base64Data = arrayBufferToBase64(pdfOutput);
  const fileName = `CustomerLedger ${sanitizeFilePart(customerName)} ${dayMonthShortYear(new Date())}.pdf`;

  if (Capacitor.getPlatform() === 'web') {
    const blob = new Blob([pdfOutput], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
    return { success: true, message: 'PDF downloaded successfully', fileName };
  }

  if ((options.mode || 'save') === 'share') {
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache
    });
    const fileUri = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache
    });
    await Share.share({
      title: 'Customer Ledger PDF',
      text: `Ledger report for ${customerName}`,
      url: fileUri.uri,
      dialogTitle: 'Share Customer Ledger PDF'
    });
    return { success: true, message: 'Customer ledger PDF shared successfully', fileName };
  }

  await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Documents
  });
  return { success: true, message: 'Customer ledger PDF saved successfully', fileName };
};

// Generate PDF for a specific month (for L/B History feature)
export const generateMonthlyBalancePDF = async (
  customerId: string, 
  customerName: string, 
  month: string, 
  year: number,
  forceShare: boolean = false
) => {
  // Parse the month name to get the date
  const monthDate = parse(`${month} ${year}`, 'MMMM yyyy', new Date());
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  
  // Get all monthly balances to find previous month
  const monthlyBalances: MonthlyBalance[] = await generateMonthlyBalances(customerId);
  const currentMonthIndex = monthlyBalances.findIndex(
    b => b.month === month && b.year === year
  );
  
  // Get previous month's balance for opening balance
  const previousMonthBalance = currentMonthIndex > 0 
    ? monthlyBalances[currentMonthIndex - 1] 
    : null;
  
  // Get bills for the selected month
  const bills = (await getBillsByCustomer(customerId)).filter(bill => {
    const billDate = parseStoredDateToLocal(bill.date);
    return billDate >= monthStart && billDate <= monthEnd;
  });

  const doc = new jsPDF({ orientation: 'landscape' });

  addPdfHeaderTagline(doc, 14);

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(customerName, 20, 34);
  
  doc.setFontSize(14);
  doc.text('Customer Summary Report', 20, 44);

  doc.setFontSize(12);
  doc.text(`Month: ${format(monthDate, 'MMMM yyyy')}`, 20, 54);
  doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy')}`, 20, 61);

  // Get payments for this customer for the selected month
  const payments = getPayments();
  const customerPayments = payments.filter(p => 
    p.customerId === customerId && 
    parseStoredDateToLocal(p.date) >= monthStart && 
    parseStoredDateToLocal(p.date) <= monthEnd
  );

  const { salesRows, paymentRows, totalSales, totalPaid } = buildLastBalanceTableRows(
    bills,
    customerPayments,
    previousMonthBalance?.closingBalance
  );

  const maxRows = Math.max(salesRows.length, paymentRows.length, 1);
  const tableData = Array.from({ length: maxRows }, (_, index) => [
    salesRows[index]?.salesSrNo ?? '',
    salesRows[index]?.salesDate ?? '',
    salesRows[index]?.itemName ?? '',
    salesRows[index]?.salesNote ?? '',
    salesRows[index]?.quantity ?? '',
    salesRows[index]?.rate ?? '',
    salesRows[index]?.totalAmount ?? '',
    paymentRows[index]?.paymentSrNo ?? '',
    paymentRows[index]?.paymentDate ?? '',
    paymentRows[index]?.paymentNote ?? '',
    paymentRows[index]?.amountPaid ?? ''
  ]);

  autoTable(doc, {
    head: [['Sr Number', 'Date', 'Item', 'Note', 'Quantity', 'Rate', 'Total Amt', 'Sr Number', 'Payment Date', 'Note', 'Amt Paid']],
    body: tableData,
    startY: 69,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.8, valign: 'middle' },
    headStyles: { fillColor: [52, 73, 190], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 32 },
      3: { cellWidth: 28 },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 12, halign: 'center' },
      8: { cellWidth: 24, halign: 'center' },
      9: { cellWidth: 24 },
      10: { cellWidth: 20, halign: 'right' }
    },
  });

  // Summary section
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  
  // Add Summary heading
  doc.text('Summary', 20, finalY);
  
  // Add summary details
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Sales: Rs. ${totalSales.toFixed(2)}`, 20, finalY + 10);
  doc.text(`Total Paid: Rs. ${totalPaid.toFixed(2)}`, 20, finalY + 20);
  
  // Add pending amount in red
  const pendingAmount = totalSales - totalPaid;
  doc.setTextColor(255, 0, 0);
  doc.text(`Pending Amount: ${formatPdfAmount(pendingAmount)}`, 20, finalY + 30);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  addPdfFooterLines(doc);

  try {
    // Generate PDF data
    const pdfOutput = doc.output('arraybuffer');
    const base64Data = arrayBufferToBase64(pdfOutput);
    const fileName = `MonthlyBalance ${sanitizeFilePart(customerName)} ${format(new Date(), 'dd-MM-yyyy')}.pdf`;
    
    if (Capacitor.getPlatform() === 'web') {
      const blob = new Blob([pdfOutput], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
      return { success: true, message: 'PDF downloaded successfully' };
    } else {
      // For mobile platforms
      try {
        if (forceShare) {
          const uniqueFileName = fileName;

          await Filesystem.writeFile({
            path: uniqueFileName,
            data: base64Data,
            directory: Directory.Cache
          });

          const fileUri = await Filesystem.getUri({
            path: uniqueFileName,
            directory: Directory.Cache
          });

          await Share.share({
            title: 'Monthly Balance PDF',
            text: `Balance Statement for ${customerName} - ${format(monthDate, 'MMMM yyyy')}`,
            url: fileUri.uri,
            dialogTitle: 'Share Monthly Balance PDF'
          });

          return {
            success: true,
            message: 'Monthly Balance PDF shared successfully!'
          };
        }

        const uniqueFileName = fileName;
        
        await Filesystem.writeFile({
          path: uniqueFileName,
          data: base64Data,
          directory: Directory.Cache
        });

        const fileInfo = await Filesystem.getUri({
          path: uniqueFileName,
          directory: Directory.Cache
        });

        if (!fileInfo.uri) {
          throw new Error('Could not get file URI');
        }

        await Share.share({
          title: 'Monthly Balance PDF',
          text: `Balance Statement for ${customerName} - ${format(monthDate, 'MMMM yyyy')}`,
          url: fileInfo.uri,
          dialogTitle: 'Share Monthly Balance PDF'
        });

        return { 
          success: true, 
          message: 'PDF saved and shared successfully', 
          filePath: fileInfo.uri,
          fileName: uniqueFileName
        };
      } catch (err: any) {
        console.error('Mobile PDF handling error:', err);
        // Fallback: write to unique file and share
        const uniqueFileName2 = fileName;

        await Filesystem.writeFile({
          path: uniqueFileName2,
          data: base64Data,
          directory: Directory.Cache
        });

        const fileUri2 = await Filesystem.getUri({
          path: uniqueFileName2,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'Monthly Balance PDF',
          text: `Balance Statement for ${customerName} - ${format(monthDate, 'MMMM yyyy')}`,
          url: fileUri2.uri,
          dialogTitle: 'Share Monthly Balance PDF'
        });
      }
    }
  } catch (error) {
    console.error('Error handling PDF:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error('Failed to process PDF: ' + errorMessage);
  }
};

export const generateLastBalancePDF = async (customerId: string, customerName: string, forceShare: boolean = false) => {
  const monthlyBalances: MonthlyBalance[] = await generateMonthlyBalances(customerId);
  const currentDate = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const previousMonthEnd = subMonths(monthEnd, 1);

  const previousMonthBalance = monthlyBalances.find(
    balance =>
      balance.month === format(previousMonthEnd, 'MMMM') &&
      balance.year === previousMonthEnd.getFullYear()
  );

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const bills = (await getBillsByCustomer(customerId)).filter(bill => {
    const billDate = parseStoredDateToLocal(bill.date);
    return billDate >= monthStart && billDate <= today;
  });

  const currentMonthPayments = getPayments().filter(payment => {
    if (payment.customerId !== customerId) return false;
    const paymentDate = parseStoredDateToLocal(payment.date);
    return paymentDate >= monthStart && paymentDate <= today;
  });

  const { salesRows, paymentRows, totalSales, totalPaid } = buildLastBalanceTableRows(
    bills,
    currentMonthPayments,
    previousMonthBalance?.closingBalance
  );

  const maxRows = Math.max(salesRows.length, paymentRows.length, 1);
  const tableData = Array.from({ length: maxRows }, (_, index) => [
    salesRows[index]?.salesSrNo ?? '',
    salesRows[index]?.salesDate ?? '',
    salesRows[index]?.itemName ?? '',
    salesRows[index]?.salesNote ?? '',
    salesRows[index]?.quantity ?? '',
    salesRows[index]?.rate ?? '',
    salesRows[index]?.totalAmount ?? '',
    paymentRows[index]?.paymentSrNo ?? '',
    paymentRows[index]?.paymentDate ?? '',
    paymentRows[index]?.paymentNote ?? '',
    paymentRows[index]?.amountPaid ?? ''
  ]);

  const doc = new jsPDF({ orientation: 'landscape' });

  addPdfHeaderTagline(doc, 14);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(customerName, 14, 34);

  doc.setFontSize(14);
  doc.text('Last Balance Report', 14, 44);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatPdfDate(new Date())}`, 14, 54);

  autoTable(doc, {
    head: [['Sr Number', 'Date', 'Item', 'Note', 'Quantity', 'Rate', 'Total Amt', 'Sr Number', 'Payment Date', 'Note', 'Amt Paid']],
    body: tableData,
    startY: 64,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.8, valign: 'middle' },
    headStyles: { fillColor: [52, 73, 190], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 32 },
      3: { cellWidth: 28 },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 12, halign: 'center' },
      8: { cellWidth: 24, halign: 'center' },
      9: { cellWidth: 24 },
      10: { cellWidth: 20, halign: 'right' }
    }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 10;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (finalY > pageHeight - 30) {
    doc.addPage('landscape');
    finalY = 20;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, finalY);

  doc.setFont('helvetica', 'normal');
  doc.text(`Total Sales: ${formatPdfAmount(totalSales)}`, 14, finalY + 10);
  doc.text(`Total Paid: ${formatPdfAmount(totalPaid)}`, 14, finalY + 20);

  const pendingAmount = totalSales - totalPaid;
  doc.setTextColor(255, 0, 0);
  doc.text(`Pending Amount: ${formatPdfAmount(pendingAmount)}`, 14, finalY + 30);
  doc.setTextColor(0, 0, 0);

  addPdfFooterLines(doc, doc.internal.pageSize.getWidth() / 2);

  try {
    const pdfOutput = doc.output('arraybuffer');
    const base64Data = arrayBufferToBase64(pdfOutput);
    const fileName = `LastBalance ${sanitizeFilePart(customerName)} ${dayMonthShortYear(new Date())}.pdf`;

    if (Capacitor.getPlatform() === 'web') {
      const blob = new Blob([pdfOutput], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
      return { success: true, message: 'PDF downloaded successfully' };
    }

    try {
      const uniqueFileName = fileName;

      await Filesystem.writeFile({
        path: uniqueFileName,
        data: base64Data,
        directory: Directory.Cache
      });

      const fileUri = await Filesystem.getUri({
        path: uniqueFileName,
        directory: Directory.Cache
      });

      await Share.share({
        title: 'Last Balance PDF',
        text: `Last Balance Statement for ${customerName}`,
        url: fileUri.uri,
        dialogTitle: 'Share Last Balance PDF'
      });

      return {
        success: true,
        message: forceShare ? 'Last Balance PDF shared successfully!' : 'PDF saved and shared successfully',
        filePath: fileUri.uri,
        fileName: uniqueFileName
      };
    } catch (err) {
      console.error('Mobile PDF handling error:', err);
      const fallbackFileName = fileName;

      await Filesystem.writeFile({
        path: fallbackFileName,
        data: base64Data,
        directory: Directory.Cache
      });

      const fallbackUri = await Filesystem.getUri({
        path: fallbackFileName,
        directory: Directory.Cache
      });

      await Share.share({
        title: 'Last Balance PDF',
        text: `Last Balance Statement for ${customerName}`,
        url: fallbackUri.uri,
        dialogTitle: 'Share Last Balance PDF'
      });

      return {
        success: true,
        message: 'Last Balance PDF shared successfully!',
        filePath: fallbackUri.uri,
        fileName: fallbackFileName
      };
    }
  } catch (error) {
    console.error('Error handling PDF:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error('Failed to process PDF: ' + errorMessage);
  }
};
