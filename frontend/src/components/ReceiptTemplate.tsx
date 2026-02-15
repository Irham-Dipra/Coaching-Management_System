import React from 'react';

interface ReceiptProps {
    payment: any;
}

const ReceiptTemplate: React.FC<ReceiptProps> = ({ payment }) => {
    return (
        <div className="w-[210mm] h-[92mm] bg-white border-b border-dashed border-slate-400 p-6 print:p-4 mb-0 page-break-inside-avoid flex flex-col justify-between relative">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 leading-tight">SCIENCE POINT</h1>
                    <p className="text-xs font-bold text-slate-600">by Dr. Talha</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Main Road, Pabna | 01700000000</p>
                </div>
                <div className="text-right">
                    <div className="inline-block bg-slate-100 px-2 py-0.5 rounded textxs font-bold text-slate-700 mb-0.5">
                        RECEIPT
                    </div>
                    <p className="text-xs text-slate-600">No: <span className="font-mono font-bold">{payment.payment_id}</span></p>
                    <p className="text-[10px] text-slate-500">{payment.payment_date}</p>
                </div>
            </div>

            {/* Student Info */}
            <div className="flex justify-between items-center mb-2 text-xs border-b border-slate-100 pb-1">
                <div>
                    <span className="text-slate-500 uppercase mr-2">Name:</span>
                    <span className="font-bold text-slate-800">{payment.student_name}</span>
                </div>
                <div>
                    <span className="text-slate-500 uppercase mr-2">ID:</span>
                    <span className="font-mono font-bold text-slate-800">{payment.student_code || payment.student_id}</span>
                </div>
            </div>

            {/* Payment Details Table */}
            <table className="w-full text-xs mb-1 flex-1">
                <thead>
                    <tr className="bg-slate-50 border-b border-t border-slate-200">
                        <th className="text-left py-1 px-2 font-semibold text-slate-600">Description</th>
                        <th className="text-right py-1 px-2 font-semibold text-slate-600">Month/Year</th>
                        <th className="text-right py-1 px-2 font-semibold text-slate-600">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b border-slate-50">
                        <td className="py-1 px-2 text-slate-700">Tuition Fee - {payment.program_name}</td>
                        <td className="py-1 px-2 text-right text-slate-700 font-mono">
                            {/* Use date_display from backend if available, else fallback */}
                            {payment.date_display || (payment.month ? `${new Date(0, payment.month - 1).toLocaleString('default', { month: 'short' })} ${payment.year}` : '-')}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-slate-800 font-mono">
                            ৳{payment.paid_amount?.toLocaleString()}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Total Row (Inline) */}
            <div className="flex justify-end items-center gap-4 text-sm mb-2 px-2">
                <span className="font-bold text-slate-700">Total Paid:</span>
                <span className="font-bold text-slate-900 border-b border-slate-300 px-1">৳{payment.paid_amount?.toLocaleString()}</span>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end pt-1">
                <div>
                    <p className="text-[10px] text-slate-400">Method: {payment.payment_method || 'Cash'} {payment.remarks ? `| Note: ${payment.remarks}` : ''}</p>
                </div>
                <div className="text-center">
                    <div className="w-24 border-t border-slate-300 mb-0.5"></div>
                    <p className="text-[9px] text-slate-400 uppercase">Authorized Signature</p>
                </div>
            </div>

            {/* Cut Line */}
            <div className="absolute bottom-0 w-full text-center text-[8px] text-slate-300 print:hidden translate-y-full">
                - - - Cut Here - - -
            </div>
        </div>
    );
};

export default ReceiptTemplate;
