import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlyBalance } from '@/types';
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

  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(customerName, 20, 20);
  
  doc.setFontSize(14);
  doc.text('Customer Summary Report', 20, 30);

  doc.setFontSize(12);
  doc.text(`Month: ${format(monthDate, 'MMMM yyyy')}`, 20, 40);
  doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy')}`, 20, 47);

  // Get payments for this customer for the selected month
  const payments = getPayments();
  const customerPayments = payments.filter(p => 
    p.customerId === customerId && 
    new Date(p.date) >= monthStart && 
    new Date(p.date) <= monthEnd
  );

  // Prepare aligned rows for sales/payments so we don't show placeholder dashes
  const salesRows: Array<{ sr: string; date: string; item: string; total: string }> = [];
  const paymentRows: Array<{ date: string; amount: string }> = [];
  let srCounter = 1;
  let totalSales = 0;
  let totalPaid = 0;

  // Add "Last Month Closing Balance" as first row if previous month balance exists
  // The closing balance already accounts for payments (openingBalance + bills - payments)
  if (previousMonthBalance && typeof previousMonthBalance.closingBalance === 'number') {
    const closingBalance = previousMonthBalance.closingBalance;
    salesRows.push({
      sr: '',
      date: '',
      item: 'Last Month Closing Balance',
      total: `Rs. ${closingBalance.toFixed(2)}`
    });
    // Add closing balance to total sales
    totalSales += closingBalance;
  }

  // Sort bills by date (ascending)
  bills.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Sort payments by date (ascending)
  customerPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // First, add all sales (bills) in ascending date order with no gaps
  bills.forEach(bill => {
    const billDate = new Date(bill.date);
    salesRows.push({
      sr: String(srCounter++),
      date: format(billDate, 'dd/MM/yyyy'),
      item: bill.items.map(i => i.itemName).join(', '),
      total: `Rs. ${bill.grandTotal.toFixed(2)}`
    });
    totalSales += bill.grandTotal;
  });

  // Then, add all payments in ascending date order with no gaps
  customerPayments.forEach(payment => {
    paymentRows.push({
      date: format(new Date(payment.date), 'dd/MM/yyyy'),
      amount: `Rs. ${payment.amount.toFixed(2)}`
    });
    totalPaid += payment.amount;
  });

  const maxRows = Math.max(salesRows.length, paymentRows.length);
  const tableData: any[] = [];
  for (let i = 0; i < maxRows; i++) {
    tableData.push([
      salesRows[i]?.sr ?? '',
      salesRows[i]?.date ?? '',
      salesRows[i]?.item ?? '',
      salesRows[i]?.total ?? '',
      paymentRows[i]?.date ?? '',
      paymentRows[i]?.amount ?? ''
    ]);
  }

  // Generate table
  autoTable(doc, {
    head: [['Sr No', 'Date', 'Item Name', 'Total', 'Payment Date', 'Paid']],
    body: tableData,
    startY: 55,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [52, 73, 190], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' }, // Sr No
      1: { cellWidth: 25, halign: 'center' }, // Date
      2: { cellWidth: 45 }, // Item Name
      3: { cellWidth: 25, halign: 'right' }, // Total
      4: { cellWidth: 25, halign: 'center' }, // Payment Date
      5: { cellWidth: 25, halign: 'right' }, // Paid
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
  doc.text(`Pending Amount: Rs. ${pendingAmount.toFixed(2)}`, 20, finalY + 30);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Add thank you note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Thank you for your business!', 20, finalY + 45);

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
  // Get all monthly balances
  const monthlyBalances: MonthlyBalance[] = await generateMonthlyBalances(customerId);
  
  // Get the current date and determine the month to show
  const currentDate = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const previousMonthEnd = subMonths(monthEnd, 1);
  
  // Find previous month's balance for opening balance
  const previousMonthBalance = monthlyBalances.find(
    balance => 
      balance.month === format(previousMonthEnd, 'MMMM') && 
      balance.year === previousMonthEnd.getFullYear()
  );
  
  // Get all bills for the current month up to today (not just month end)
  const today = new Date();
  today.setHours(23, 59, 59, 999); // Include today
  const bills = (await getBillsByCustomer(customerId)).filter(bill => {
    const billDate = new Date(bill.date);
    return billDate >= monthStart && billDate <= today;
  });

  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(customerName, 20, 20);
  
  doc.setFontSize(14);
  doc.text('Customer Summary Report', 20, 30);

  doc.setFontSize(12);
  doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, 20, 40);

  // Get payments for this customer - filter for current month
  const payments = getPayments();
  const allCustomerPayments = payments.filter(p => p.customerId === customerId);
  const currentMonthPayments = allCustomerPayments.filter(p => {
    const paymentDate = new Date(p.date);
    return paymentDate >= monthStart && paymentDate <= today;
  });

  const salesRows: Array<{ sr: string; date: string; item: string; total: string }> = [];
  const paymentRows: Array<{ date: string; amount: string }> = [];
  let srCounter = 1;
  let totalSales = 0;
  let totalPaid = 0;

  // Add "Last Month Closing Balance" as first row if previous month balance exists
  // The closing balance already accounts for payments (openingBalance + bills - payments)
  if (previousMonthBalance && typeof previousMonthBalance.closingBalance === 'number') {
    const closingBalance = previousMonthBalance.closingBalance;
    salesRows.push({
      sr: '',
      date: '',
      item: 'Last Month Closing Balance',
      total: `Rs. ${closingBalance.toFixed(2)}`
    });
    // Add closing balance to total sales
    totalSales += closingBalance;
  }

  // Sort bills by date (ascending)
  bills.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Sort payments by date (ascending)
  currentMonthPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // First, add all sales (bills) in ascending date order with no gaps
  bills.forEach(bill => {
    const billDate = new Date(bill.date);
    salesRows.push({
      sr: String(srCounter++),
      date: format(billDate, 'dd/MM/yyyy'),
      item: bill.items.map(i => i.itemName).join(', '),
      total: `Rs. ${bill.grandTotal.toFixed(2)}`
    });
    totalSales += bill.grandTotal;
  });

  // Then, add all payments in ascending date order with no gaps
  currentMonthPayments.forEach(payment => {
    paymentRows.push({
      date: format(new Date(payment.date), 'dd/MM/yyyy'),
      amount: `Rs. ${payment.amount.toFixed(2)}`
    });
    totalPaid += payment.amount;
  });

  const maxRows = Math.max(salesRows.length, paymentRows.length);
  const tableData: any[] = [];
  for (let i = 0; i < maxRows; i++) {
    tableData.push([
      salesRows[i]?.sr ?? '',
      salesRows[i]?.date ?? '',
      salesRows[i]?.item ?? '',
      salesRows[i]?.total ?? '',
      paymentRows[i]?.date ?? '',
      paymentRows[i]?.amount ?? ''
    ]);
  }

  // Generate table
  autoTable(doc, {
    head: [['Sr No', 'Date', 'Item Name', 'Total', 'Payment Date', 'Paid']],
    body: tableData,
    startY: 50,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [52, 73, 190], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' }, // Sr No
      1: { cellWidth: 25, halign: 'center' }, // Date
      2: { cellWidth: 45 }, // Item Name
      3: { cellWidth: 25, halign: 'right' }, // Total
      4: { cellWidth: 25, halign: 'center' }, // Payment Date
      5: { cellWidth: 25, halign: 'right' }, // Paid
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
  doc.text(`Pending Amount: Rs. ${pendingAmount.toFixed(2)}`, 20, finalY + 30);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Add thank you note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Thank you for your business!', 20, finalY + 45);

  try {
    // Generate PDF data
    const pdfOutput = doc.output('arraybuffer');
    const base64Data = arrayBufferToBase64(pdfOutput);
  const fileName = `${customerName.replace(/\s+/g, '_')}_last_balance_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    if (Capacitor.getPlatform() === 'web') {
      // Try a runtime Blob-worker fallback: create a worker from a JS string that
      // imports jspdf and autotable from CDN via importScripts. This avoids
      // bundler issues and keeps PDF work off the main thread.
      try {
        const workerCode = `
          self.importScripts('https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js');
          self.importScripts('https://unpkg.com/jspdf-autotable@3.5.28/dist/jspdf.plugin.autotable.js');

          self.onmessage = function(e) {
            try {
              const { bills, payments, customerName, previousMonthBalance } = e.data;
              const doc = (self as any).jspdf.jsPDF();

              // Header
              doc.setFontSize(18);
              doc.setFont('helvetica', 'bold');
              doc.text(customerName, 20, 20);
              
              doc.setFontSize(14);
              doc.text('Customer Summary Report', 20, 30);
              
              doc.setFontSize(12);
              doc.text('Date: ' + (new Date()).toLocaleDateString('en-GB'), 20, 40);

              // Build table rows and summary
              const tableData = [];
              let srNo = 1;
              let totalSales = 0;
              let totalPaid = 0;

              // Add "Last Month Closing Balance" as first row if previous month balance exists
              // The closing balance already accounts for payments (openingBalance + bills - payments)
              if (previousMonthBalance !== undefined && previousMonthBalance !== null) {
                const closingBalance = Number(previousMonthBalance) || 0;
                tableData.push([
                  '-',
                  '-',
                  'Last Month Closing Balance',
                  'Rs. ' + closingBalance.toFixed(2),
                  '-',
                  '-'
                ]);
                // Add closing balance to total sales
                totalSales += closingBalance;
              }

              // Sort bills by date (ascending)
              bills.sort(function(a,b){ return new Date(a.date).getTime() - new Date(b.date).getTime(); });
              // Sort payments by date (ascending)
              (payments || []).sort(function(a,b){ return new Date(a.date).getTime() - new Date(b.date).getTime(); });

              // First, add all sales (bills) in ascending date order with no gaps
              bills.forEach(function(bill){
                const billDate = new Date(bill.date);
                const billDateStr = billDate.toLocaleDateString('en-GB');
                
                tableData.push([
                  srNo++,
                  billDateStr,
                  (bill.items || []).map(function(i){ return i.itemName; }).join(', '),
                  'Rs. ' + Number(bill.grandTotal).toFixed(2),
                  '-',
                  '-'
                ]);

                totalSales += Number(bill.grandTotal) || 0;
              });

              // Then, add all payments in ascending date order with no gaps
              (payments || []).forEach(function(payment){
                tableData.push([
                  srNo++,
                  '-',
                  '-',
                  '-',
                  (new Date(payment.date)).toLocaleDateString('en-GB'),
                  'Rs. ' + Number(payment.amount).toFixed(2)
                ]);
                totalPaid += Number(payment.amount) || 0;
              });

              const tableStartY = 50;
              (doc as any).autoTable({
                head: [['Sr No', 'Date', 'Item Name', 'Total', 'Payment Date', 'Paid']],
                body: tableData,
                startY: tableStartY,
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 2 }
              });

              const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 100;
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.text('Summary', 20, finalY);
              doc.setFont('helvetica', 'normal');
              doc.text('Total Sales: Rs. ' + totalSales.toFixed(2), 20, finalY + 10);
              doc.text('Total Paid: Rs. ' + totalPaid.toFixed(2), 20, finalY + 20);
              const pendingAmount = totalSales - totalPaid;
              doc.setTextColor(255,0,0);
              doc.text('Pending Amount: Rs. ' + pendingAmount.toFixed(2), 20, finalY + 30);
              doc.setTextColor(0,0,0);
              doc.setFontSize(10);
              doc.text('Thank you for your business!', 20, finalY + 45);

              const arr = doc.output('arraybuffer');
              // Transfer the buffer
              self.postMessage({ type: 'generate-last-balance-pdf-result', buffer: arr }, [arr]);
            } catch (err) {
              self.postMessage({ type: 'error', message: (err && err.message) ? err.message : String(err) });
            }
          };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);

        return await new Promise<any>((resolve, reject) => {
          worker.onmessage = (ev) => {
            const msg = (ev.data as any);
            if (msg.type === 'generate-last-balance-pdf-result') {
              const buffer = msg.buffer as ArrayBuffer;
              const blob = new Blob([buffer], { type: 'application/pdf' });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = fileName;
              link.click();
              URL.revokeObjectURL(url);
              worker.terminate();
              URL.revokeObjectURL(workerUrl);
              resolve({ success: true, message: 'PDF downloaded successfully' });
            } else if (msg.type === 'error') {
              worker.terminate();
              URL.revokeObjectURL(workerUrl);
              reject(new Error(msg.message || 'Worker failed'));
            }
          };

          worker.onerror = (err) => {
            try { 
              worker.terminate(); 
              URL.revokeObjectURL(workerUrl); 
            } catch (e) {
              // Ignore cleanup errors
            }
            reject(err instanceof Error ? err : new Error('Worker runtime error'));
          };

          // Send minimal data needed to worker; payments list filtered for current month
          worker.postMessage({ 
            bills, 
            payments: currentMonthPayments, 
            customerName, 
            previousMonthBalance: previousMonthBalance?.closingBalance 
          });
        });
      } catch (workerErr) {
        // If blob-worker creation or runtime fails, fallback to main-thread behavior
        console.warn('Blob-worker PDF generation failed, falling back to main thread', workerErr);
        const blob = new Blob([pdfOutput], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        window.URL.revokeObjectURL(url);
        return { success: true, message: 'PDF downloaded successfully' };
      }
    } else {
      // For mobile platforms
      try {
       if (forceShare) {
  const timestamp = new Date().getTime();
  const uniqueFileName = `lastbal_force_${timestamp}_${fileName}`;

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
    message: 'Last Balance PDF shared successfully!'
  };
}

        // Attempt to save to filesystem first
        const timestamp = new Date().getTime();
        const uniqueFileName = `last_balance_${timestamp}_${fileName}`;
        
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

        const timestamp2 = new Date().getTime();
const uniqueFileName2 = `lastbal_fallback_${timestamp2}_${fileName}`;

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
  title: 'Last Balance PDF',
  text: `Last Balance Statement for ${customerName}`,
  url: fileUri2.uri,
  dialogTitle: 'Share Last Balance PDF'
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
        const uniqueFileName2 = `lastbal_fallback_${timestamp2}_${fileName}`;

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
          title: 'Last Balance PDF',
          text: `Last Balance Statement for ${customerName}`,
          url: fileUri2.uri,
          dialogTitle: 'Share Last Balance PDF'
        });
      }
    }
  } catch (error) {
    console.error('Error handling PDF:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error('Failed to process PDF: ' + errorMessage);
  }
};