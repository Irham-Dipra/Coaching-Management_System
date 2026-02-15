import React from 'react';

interface ReceiptProps {
    payment: any;
}

const ReceiptTemplate: React.FC<ReceiptProps> = ({ payment }) => {
    return (
        <div className="w-[210mm] bg-white border-b border-dashed border-slate-400 p-8 print:p-6 mb-4 print:mb-0 page-break-inside-avoid">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">MONIEM COACHING CENTER</h1>
                    <p className="text-sm text-slate-500">Excellence in Education</p>
                    <p className="text-xs text-slate-400 mt-1">Address: Main Road, Pabna | Contact: 01700000000</p>
                </div>
                <div className="text-right">
                    <div className="inline-block bg-slate-100 px-3 py-1 rounded text-sm font-bold text-slate-700 mb-1">
                        RECEIPT
                    </div>
                    <p className="text-sm text-slate-600">No: <span className="font-mono font-bold">{payment.payment_id}</span></p>
                    <p className="text-xs text-slate-500">Date: {payment.payment_date}</p>
                </div>
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                    <p className="text-slate-500 text-xs uppercase">Student Name</p>
                    <p className="font-bold text-slate-800">{payment.student_name}</p>
                </div>
                <div>
                    <p className="text-slate-500 text-xs uppercase">Student ID</p>
                    <p className="font-mono font-bold text-slate-800">{payment.student_code || payment.student_id}</p>
                </div>
            </div>

            {/* Payment Details Table */}
            <table className="w-full text-sm mb-6">
                <thead>
                    <tr className="bg-slate-50 border-b border-t border-slate-200">
                        <th className="text-left py-2 px-3 font-semibold text-slate-600">Description</th>
                        <th className="text-right py-2 px-3 font-semibold text-slate-600">Month/Year</th>
                        <th className="text-right py-2 px-3 font-semibold text-slate-600">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-700">Tuition Fee - {payment.program_name}</td>
                        <td className="py-2 px-3 text-right text-slate-700 font-mono">
                            {new Date(0, payment.month - 1).toLocaleString('default', { month: 'short' })} {payment.year}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800 font-mono">
                            ৳{payment.paid_amount?.toLocaleString()}
                        </td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={2} className="py-2 px-3 text-right font-bold text-slate-800">Total Paid:</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 text-lg font-mono">
                            ৳{payment.paid_amount?.toLocaleString()}
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* Footer */}
            <div className="flex justify-between items-end mt-8 pt-4">
                <div>
                    <p className="text-xs text-slate-400">Payment Method: {payment.payment_method || 'Cash'}</p>
                    {payment.remarks && <p className="text-xs text-slate-400 italic mt-1">Note: {payment.remarks}</p>}
                </div>
                <div className="text-center">
                    <div className="w-32 border-t border-slate-300 mb-1"></div>
                    <p className="text-[10px] text-slate-400 uppercase">Authorized Signature</p>
                </div>
            </div>

            <div className="text-center text-[10px] text-slate-300 mt-4 print:hidden">
                - - - - - - - - - - Cut Here - - - - - - - - - -
            </div>
        </div>
    );
};

export default ReceiptTemplate;
