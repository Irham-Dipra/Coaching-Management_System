import jsPDF from 'jspdf';

export const generatePaymentSlip = (payment: any) => {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [210, 99]
    });

    // Watermark / Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("Coaching Centre Name", 10, 15);
    doc.setFontSize(10);
    doc.text("Address Line 1, City", 10, 20);

    doc.setFontSize(16);
    doc.text("MONEY RECEIPT", 160, 15, { align: 'right' });
    doc.setLineWidth(0.5);
    doc.line(10, 25, 200, 25);

    // Details - Adjust specifically for Bulk vs Single
    // If 'payment.date_display' exists (from Bulk/Recent view), use it.
    // Else use month/year.

    doc.setFontSize(12);
    doc.text(`Receipt No: #${payment.payment_id}`, 10, 35);
    doc.text(`Date: ${payment.payment_date}`, 160, 35, { align: 'right' });

    doc.text(`Received with thanks from:`, 10, 45);
    doc.setFont('helvetica', 'bold');
    doc.text(`${payment.student_name} ${payment.roll_no ? `(Roll: ${payment.roll_no})` : ''}`, 65, 45);

    doc.setFont('helvetica', 'normal');
    doc.text(`Program:`, 10, 52);
    doc.text(`${payment.program_name}`, 65, 52);

    // Payment Info
    doc.text(`For:`, 10, 59);
    // Prefer the pre-calculated display string if available, else fallback
    const forText = payment.date_display || (payment.month ? `${new Date(0, payment.month - 1).toLocaleString('default', { month: 'long' })} ${payment.year}` : '-');
    doc.text(forText, 65, 59);

    doc.text(`Method: ${payment.payment_method || 'Cash'}`, 160, 52, { align: 'right' });

    // Amount Box
    doc.rect(10, 65, 190, 20);
    doc.setFontSize(14);
    doc.text("Amount Paid:", 15, 78);
    doc.setFont('helvetica', 'bold');
    // Handle total_amount (Bulk) or paid_amount (Single db row)
    const amount = payment.total_amount || payment.paid_amount || 0;
    doc.text(`BDT ${amount}/-`, 50, 78);

    // Remarks
    if (payment.remarks) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text(`Remarks: ${payment.remarks}`, 10, 92);
    }

    if (payment.type === 'Bulk') {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("(Bulk Transaction)", 160, 40, { align: 'right' });
    }

    doc.save(`Receipt_${payment.payment_id}.pdf`);
};
