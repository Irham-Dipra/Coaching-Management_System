import * as XLSX from 'xlsx';
import fs from 'fs';

const templateData = [
    { "Student Code": "A", "Student Name": "John", "Program Name": "Prog", "Written": 10, "MCQ": 10 },
    { "Student Code": "B", "Student Name": "Jane", "Program Name": "Prog", "Written": "", "MCQ": "" },
    { "Student Code": "C", "Student Name": "Jill", "Program Name": "Prog", "Written": null, "MCQ": null }
];

const ws = XLSX.utils.json_to_sheet(templateData, {
    header: ["Student Code", "Student Name", "Program Name", "Written", "MCQ"]
});

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Result Entry");

const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });

function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
}

fs.writeFileSync('test_output.xlsx', new Uint8Array(s2ab(wbout)));
console.log("Empty data test complete. Generated test_output.xlsx");
