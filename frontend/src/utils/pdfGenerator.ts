import jsPDF from 'jspdf';

export const generatePaymentSlip = (payment: any) => {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [210, 110]
    });

    const pageWidth = 210;
    const marginLeft = 12;
    const marginRight = 12;
    const contentRight = pageWidth - marginRight;
    const contentWidth = pageWidth - marginLeft - marginRight;

    // ── HEADER ──────────────────────────────────────────
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(marginLeft, 10, contentRight, 10);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("SCIENCE POINT", marginLeft, 19);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text("by Dr. Talha", marginLeft, 24);

    // Title on right
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text("MONEY RECEIPT", contentRight, 19, { align: 'right' });

    if (payment.type === 'Bulk') {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text("(Bulk Transaction)", contentRight, 24, { align: 'right' });
    }

    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(marginLeft, 27, contentRight, 27);

    // ── RECEIPT META ────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text("Receipt No.", marginLeft, 34);
    doc.text("Date", contentRight - 30, 34);

    const receiptNo = payment.payment_id || payment.sort_id || payment.transaction_id || 'N/A';

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`#${receiptNo}`, marginLeft + 28, 34);
    doc.text(`${payment.payment_date}`, contentRight, 34, { align: 'right' });

    // ── DETAILS ─────────────────────────────────────────
    let y = 44;
    const labelX = marginLeft;
    const valueX = marginLeft + 35;

    const addRow = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(label, labelX, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(value, valueX, y);
        y += 8;
    };

    const studentText = `${payment.student_name}${payment.roll_no ? `  (Roll: ${payment.roll_no})` : ''}`;
    addRow("Received from", studentText);
    addRow("Program", `${payment.program_name}`);

    const forText = payment.date_display || (payment.month ? `${new Date(0, payment.month - 1).toLocaleString('default', { month: 'long' })} ${payment.year}` : '—');
    addRow("For", forText);

    // Payment method on right, aligned with "For" row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("Method", contentRight - 40, y - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${payment.payment_method || 'Cash'}`, contentRight, y - 8, { align: 'right' });

    // ── AMOUNT BOX ──────────────────────────────────────
    y += 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.rect(marginLeft, y, contentWidth, 16);

    // Inner line separating label from amount
    doc.setLineWidth(0.2);
    doc.line(marginLeft + 40, y, marginLeft + 40, y + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Amount Paid", marginLeft + 5, y + 10);

    const amount = payment.total_amount || payment.paid_amount || 0;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`BDT ${amount}/-`, marginLeft + 45, y + 11);

    // ── REMARKS & FOOTER ────────────────────────────────
    y += 20;

    if (payment.remarks) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text(`Remarks: ${payment.remarks}`, marginLeft, y);
    }

    // Footer line
    const footerY = 104;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, footerY, contentRight, footerY);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text("Science Point Management System", marginLeft, footerY + 4);
    doc.text("Authorized Signature: ___________________", contentRight, footerY + 4, { align: 'right' });

    doc.save(`Receipt_${receiptNo}.pdf`);
};
