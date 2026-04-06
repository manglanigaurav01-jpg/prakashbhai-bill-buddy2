import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlyBalance, Bill, Payment } from '@/types';
import { startOfMonth, endOfMonth, subMonths, format, parse } from 'date-fns';
import { generateMonthlyBalances } from './monthly-balance';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { getBillsByCustomer, getPayments } from './storage';
// Note: Worker is used for heavy PDF generation on web

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const formatPdfDate = (date: Date | string) => format(new Date(date), 'dd-MM-yyyy');

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

const drawCenteredSmileEmoji = (doc: jsPDF, y: number) => {
  const centerX = doc.internal.pageSize.getWidth() / 2;
  const radius = 2.8;

  doc.setDrawColor(230, 170, 20);
  doc.setFillColor(255, 220, 70);
  doc.circle(centerX, y, radius, 'FD');

  doc.setFillColor(80, 55, 10);
  doc.circle(centerX - 0.9, y - 0.6, 0.22, 'F');
  doc.circle(centerX + 0.9, y - 0.6, 0.22, 'F');

  doc.setLineWidth(0.35);
  doc.setDrawColor(80, 55, 10);
  doc.lines(
    [
      [-1.1, 0.3],
      [0.45, 0.9],
      [1.3, 0]
    ],
    centerX - 1.1,
    y + 0.5
  );
};

const addPdfHeaderTagline = (doc: jsPDF, y: number = 20) => {
  addCenteredPdfLine(doc, 'SHUKRANA MUSKURANA!', y);
  drawCenteredSmileEmoji(doc, y + 7.5);
};

const addPdfFooterLines = (doc: jsPDF, centerX?: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const x = centerX ?? (pageWidth / 2);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Thank you for your business!', x, pageHeight - 28, { align: 'center' });

  addCenteredPdfLine(doc, 'Love Is God , God Is Love!', pageHeight - 18);
  drawCenteredSmileEmoji(doc, pageHeight - 9.5);
};

type LastBalanceSalesRow = {
  salesSrNo: string;
  salesDate: string;
  itemName: string;
  quantity: string;
  rate: string;
  totalAmount: string;
};

type LastBalancePaymentRow = {
  paymentSrNo: string;
  paymentDate: string;
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
      quantity: '',
      rate: '',
      totalAmount: formatPdfAmount(openingBalance)
    });
    totalSales += openingBalance;
  }

  [...bills]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((bill) => {
      bill.items.forEach((item, itemIndex) => {
        salesRows.push({
          salesSrNo: itemIndex === 0 ? String(salesSrNo) : '',
          salesDate: itemIndex === 0 ? formatPdfDate(bill.date) : '',
          itemName: item.itemName,
          quantity: formatPdfNumber(item.quantity),
          rate: formatPdfNumber(item.rate),
          totalAmount: formatPdfAmount(item.total)
        });
      });

      totalSales += bill.grandTotal;
      salesSrNo += 1;
    });

  [...payments]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((payment, index) => {
      paymentRows.push({
        paymentSrNo: String(index + 1),
        paymentDate: formatPdfDate(payment.date),
        amountPaid: formatPdfAmount(payment.amount)
      });
      totalPaid += payment.amount;
    });

  return { salesRows, paymentRows, totalSales, totalPaid };
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
    const billDate = new Date(bill.date);
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
    new Date(p.date) >= monthStart && 
    new Date(p.date) <= monthEnd
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
    salesRows[index]?.quantity ?? '',
    salesRows[index]?.rate ?? '',
    salesRows[index]?.totalAmount ?? '',
    paymentRows[index]?.paymentSrNo ?? '',
    paymentRows[index]?.paymentDate ?? '',
    paymentRows[index]?.amountPaid ?? ''
  ]);

  autoTable(doc, {
    head: [['Sr No', 'Date', 'Item', 'Quantity', 'Rate', 'Total Amt', 'Sr No', 'Payment Date', 'Amt Paid']],
    body: tableData,
    startY: 69,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.8, valign: 'middle' },
    headStyles: { fillColor: [52, 73, 190], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 48 },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 32, halign: 'center' },
      8: { cellWidth: 28, halign: 'right' }
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
    const fileName = `${customerName.replace(/\s+/g, '_')}_balance_${format(monthDate, 'MMMM_yyyy')}.pdf`;
    
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
          const timestamp = new Date().getTime();
          const uniqueFileName = `monthly_force_${timestamp}_${fileName}`;

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

        const timestamp = new Date().getTime();
        const uniqueFileName = `balance_${timestamp}_${fileName}`;
        
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
        const timestamp2 = new Date().getTime();
        const uniqueFileName2 = `monthly_fallback_${timestamp2}_${fileName}`;

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
    const billDate = new Date(bill.date);
    return billDate >= monthStart && billDate <= today;
  });

  const currentMonthPayments = getPayments().filter(payment => {
    if (payment.customerId !== customerId) return false;
    const paymentDate = new Date(payment.date);
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
    salesRows[index]?.quantity ?? '',
    salesRows[index]?.rate ?? '',
    salesRows[index]?.totalAmount ?? '',
    paymentRows[index]?.paymentSrNo ?? '',
    paymentRows[index]?.paymentDate ?? '',
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
    head: [['Sr No', 'Date', 'Item', 'Quantity', 'Rate', 'Total Amt', 'Sr No', 'Payment Date', 'Amt Paid']],
    body: tableData,
    startY: 64,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.8, valign: 'middle' },
    headStyles: { fillColor: [52, 73, 190], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 48 },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 32, halign: 'center' },
      8: { cellWidth: 28, halign: 'right' }
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
    const fileName = `${customerName.replace(/\s+/g, '_')}_last_balance_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

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
      const timestamp = new Date().getTime();
      const uniqueFileName = `${forceShare ? 'lastbal_force' : 'last_balance'}_${timestamp}_${fileName}`;

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
      const fallbackFileName = `lastbal_fallback_${Date.now()}_${fileName}`;

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
