import React from 'react';

interface ReceiptProps {
    payment: any;
}

const ReceiptTemplate: React.FC<ReceiptProps> = ({ payment }) => {
    return (
        <div className="w-[210mm] h-[92mm] bg-white border-b border-dashed border-black py-6 pl-1 pr-10 print:py-4 print:pl-1 print:pr-10 mb-0 page-break-inside-avoid flex flex-col justify-between relative">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h1 className="text-lg font-bold text-black leading-tight">SCIENCE POINT</h1>
                    <p className="text-xs font-bold text-black">by Dr. Talha</p>
                    <p className="text-[10px] text-black mt-0.5">Barishal Sadar,Barishal | 01797752306</p>
                </div>
                <div className="text-right">
                    <div className="inline-block border border-black px-2 py-0.5 rounded text-xs font-bold text-black mb-0.5">
                        RECEIPT
                    </div>
                    <p className="text-xs text-black">No: <span className="font-mono font-bold">{payment.payment_id}</span></p>
                    <p className="text-[10px] text-black">{payment.payment_date}</p>
                </div>
            </div>

            {/* Student Info */}
            <div className="flex justify-between items-center mb-2 text-xs border-b border-black pb-1">
                <div>
                    <span className="text-black uppercase mr-2 font-medium">Name:</span>
                    <span className="font-bold text-black">{payment.student_name}</span>
                </div>
                <div>
                    <span className="text-black uppercase mr-2 font-medium">ID:</span>
                    <span className="font-mono font-bold text-black">{payment.student_code || payment.student_id}</span>
                </div>
            </div>

            {/* Payment Details Table */}
            <div className="flex-1">
                <table className="w-full text-xs mb-2">
                    <thead>
                        <tr className="border-b border-t border-black">
                            <th className="text-left py-1 px-2 font-bold text-black">Description</th>
                            <th className="text-right py-1 px-2 font-bold text-black">Month/Year</th>
                            <th className="text-right py-1 px-2 font-bold text-black">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-black">
                            <td className="py-1 px-2 text-black">Tuition Fee - {payment.program_name}</td>
                            <td className="py-1 px-2 text-right text-black font-mono">
                                {/* Use date_display from backend if available, else fallback */}
                                {payment.date_display || (payment.month ? `${new Date(0, payment.month - 1).toLocaleString('default', { month: 'short' })} ${payment.year}` : '-')}
                            </td>
                            <td className="py-1 px-2 text-right font-bold text-black font-mono">
                                ৳{payment.paid_amount?.toLocaleString()}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Total Row */}
                <div className="flex justify-end items-center gap-4 text-sm px-2 mt-2">
                    <span className="font-bold text-black">Total Paid:</span>
                    <span className="font-bold text-black border-b-2 border-black px-1">৳{payment.paid_amount?.toLocaleString()}</span>
                </div>
            </div>

            {/* Footer with Seal */}
            <div className="flex justify-between items-end pt-2 relative">
                <div>
                    <p className="text-[10px] text-black">Method: {payment.payment_method || 'Cash'} {payment.remarks ? `| Note: ${payment.remarks}` : ''}</p>
                </div>

                {/* Seal - Replaces Signature Line */}
                <div className="text-center relative">
                    <div className="w-20 h-20 border border-black rounded-full flex items-center justify-center p-1 opacity-20">
                        {/* Blank space for physical seal */}
                    </div>
                    <p className="text-[8px] text-black mt-1 font-bold uppercase">Authorized Signature</p>
                </div>
            </div>

            {/* Cut Line */}
            <div className="absolute bottom-0 w-full text-center text-[8px] text-black print:hidden translate-y-full">
                - - - Cut Here - - -
            </div>
        </div>
    );
};

export default ReceiptTemplate;
