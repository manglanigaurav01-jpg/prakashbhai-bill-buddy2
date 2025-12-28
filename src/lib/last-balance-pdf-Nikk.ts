import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { getBillsByCustomer, getPayments } from './storage';

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const generateLastBalancePDF = async (customerId: string, customerName: string) => {
  // Get the current date and determine the month to show
  const currentDate = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Get all bills for the current month only
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
  doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, 20, 40);

  // Get payments for this customer
  const payments = getPayments();
  const customerPayments = payments.filter(p => p.customerId === customerId);

  // Table data with Sr No
  const tableData: any[] = [];
  let srNo = 1;
  let totalSales = 0;
  let totalPaid = 0;

  // Sort bills by date
  bills.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Process bills and payments
  bills.forEach(bill => {
    const payment = customerPayments.find(p => 
      format(new Date(p.date), 'dd/MM/yyyy') === format(new Date(bill.date), 'dd/MM/yyyy')
    );

    tableData.push([
      srNo++,
      format(new Date(bill.date), 'dd/MM/yyyy'),
      bill.items.map(i => i.itemName).join(', '),
      `Rs. ${bill.grandTotal.toFixed(2)}`,
      payment ? format(new Date(payment.date), 'dd/MM/yyyy') : '-',
      payment ? `Rs. ${payment.amount.toFixed(2)}` : '-'
    ]);

    totalSales += bill.grandTotal;
    if (payment) totalPaid += payment.amount;
  });

  // Generate table
  autoTable(doc, {
    head: [['Sr No', 'Date1', 'Item Name', 'Total', 'Date2', 'Jama']],
    body: tableData,
    startY: 50,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [52, 73, 190], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' }, // Sr No
      1: { cellWidth: 25, halign: 'center' }, // Date1
      2: { cellWidth: 45 }, // Item Name
      3: { cellWidth: 25, halign: 'right' }, // Total
      4: { cellWidth: 25, halign: 'center' }, // Date2
      5: { cellWidth: 25, halign: 'right' }, // Jama
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
      // For web, create a download link
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
        // Use timestamp to make filename unique
        const timestamp = new Date().getTime();
        const uniqueFileName = `last_balance_${timestamp}_${fileName}`;
        
        // Save directly to Cache directory without creating subdirectory
        await Filesystem.writeFile({
          path: uniqueFileName,
          data: base64Data,
          directory: Directory.Cache
        });

        // Get the complete file URI for sharing
        const fileInfo = await Filesystem.getUri({
          path: uniqueFileName,
          directory: Directory.Cache
        });

        if (!fileInfo.uri) {
          throw new Error('Could not get file URI');
        }

        // Share the PDF
        await Share.share({
          title: 'Last Balance PDF',
          text: `Last Balance Statement for ${customerName}`,
          url: fileInfo.uri,
          dialogTitle: 'Share Last Balance PDF'
        });

        return { 
          success: true, 
          message: 'PDF saved and shared successfully', 
          filePath: fileInfo.uri 
        };
      } catch (err) {
        console.error('Mobile PDF handling error:', err);
        throw new Error(err instanceof Error ? err.message : 'Failed to save or share PDF');
      }
    }
  } catch (error) {
    console.error('Error handling PDF:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error('Failed to process PDF: ' + errorMessage);
  }
};