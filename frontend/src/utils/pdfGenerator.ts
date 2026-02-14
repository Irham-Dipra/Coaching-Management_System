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

    // Payment method on right (Standard Position)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("Method", contentRight - 40, 52); // Fixed Y position aligned with 2nd row approx
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${payment.payment_method || 'Cash'}`, contentRight, 52, { align: 'right' });

    // HANDLE DATE / BREAKDOWN
    if (payment.sub_payments && payment.sub_payments.length > 1) {
        // BULK BREAKDOWN LOGIC (Multi-month)

        // 1. Group consecutive months with same amount
        const subs = [...payment.sub_payments].sort((a: any, b: any) => (a.year - b.year) || (a.month - b.month));
        const groups: any[] = [];
        let currentGroup: any[] = [subs[0]];

        for (let i = 1; i < subs.length; i++) {
            const prev = subs[i - 1];
            const curr = subs[i];

            // Check consecutiveness (Same year & next month OR Next year & Jan after Dec)
            const isConsecutive = (curr.year === prev.year && curr.month === prev.month + 1) ||
                (curr.year === prev.year + 1 && curr.month === 1 && prev.month === 12);
            const isSameAmount = Number(curr.amount) === Number(prev.amount);

            if (isConsecutive && isSameAmount) {
                currentGroup.push(curr);
            } else {
                groups.push(currentGroup);
                currentGroup = [curr];
            }
        }
        groups.push(currentGroup);

        // 2. Render Groups
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text("Payment For", labelX, y); // Label

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9); // Slightly smaller for list
        doc.setTextColor(0, 0, 0);

        let breakdownY = y;

        groups.forEach((g) => {
            const start = g[0];
            const end = g[g.length - 1];
            const amount = Number(start.amount);

            const startName = new Date(0, start.month - 1).toLocaleString('default', { month: 'short' });
            const endName = new Date(0, end.month - 1).toLocaleString('default', { month: 'short' });

            let lineText = "";
            let amountText = "";

            if (g.length === 1) {
                // Single Month: "Jan 2026"  ... "300"
                lineText = `${startName} ${start.year}`;
                amountText = `${amount}`;
            } else {
                // Range: "Feb - Apr 2026" ... "500 x 3 = 1500"
                const dateRange = start.year === end.year
                    ? `${startName} - ${endName} ${start.year}`
                    : `${startName} ${start.year} - ${endName} ${end.year}`;

                lineText = `${dateRange}`;
                amountText = `${amount} x ${g.length} = ${amount * g.length}`;
            }

            doc.text(lineText, valueX, breakdownY);
            doc.text(amountText, valueX + 60, breakdownY); // Align amount slightly right
            breakdownY += 5; // Tighter spacing
        });

        // Update Y for the next section (Amount Box)
        // Ensure we push Y down enough, but not too much
        y = Math.max(y + 8, breakdownY + 2);

    } else {
        // SINGLE / LEGACY DISPLAY
        const forText = payment.date_display || (payment.month ? `${new Date(0, payment.month - 1).toLocaleString('default', { month: 'long' })} ${payment.year}` : '—');
        addRow("Payment For", forText);
    }

    // ── AMOUNT BOX ──────────────────────────────────────
    y += 4; // Spacing before box
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.rect(marginLeft, y, contentWidth, 16);

    // Inner line separating label from amount
    doc.setLineWidth(0.2);
    doc.line(marginLeft + 40, y, marginLeft + 40, y + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Total Amount", marginLeft + 5, y + 10);

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
        // Wrap text if too long
        const splitRemarks = doc.splitTextToSize(`Remarks: ${payment.remarks}`, contentWidth);
        doc.text(splitRemarks, marginLeft, y);
    }

    // Footer line (Fixed at bottom)
    const footerY = 100;
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
