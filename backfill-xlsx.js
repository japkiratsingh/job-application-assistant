/**
 * One-shot: rebuild applications.xlsx from applications.csv.
 * Re-run this any time to sync the two — safe to run mid-session.
 *
 *   node backfill-xlsx.js
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const CSV_FILE = path.join(__dirname, 'applications.csv');
const XLSX_FILE = path.join(__dirname, 'applications.xlsx');
const COLUMNS = [
  { header: 'Date', key: 'date', width: 22 },
  { header: 'Site', key: 'site', width: 12 },
  { header: 'Role', key: 'role', width: 42 },
  { header: 'Company', key: 'company', width: 26 },
  { header: 'CTC/Salary', key: 'salary', width: 14 },
  { header: 'Skills', key: 'skills', width: 40 },
  { header: 'Job Link', key: 'link', width: 60 },
  { header: 'Job Description', key: 'jd', width: 80 },
];

// Minimal RFC-4180 CSV parser — handles quoted fields with embedded commas / quotes / newlines.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip — \n follows */ }
      else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
      else { field += c; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v && v.trim()));
}

(async () => {
  if (!fs.existsSync(CSV_FILE)) {
    console.log('No applications.csv found — nothing to backfill.');
    return;
  }
  const raw = fs.readFileSync(CSV_FILE, 'utf8').replace(/^﻿/, '');
  const rows = parseCsv(raw);
  if (!rows.length) { console.log('CSV is empty.'); return; }
  const [, ...dataRows] = rows; // skip header

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Applications');
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  for (const r of dataRows) {
    ws.addRow({
      date: r[0] || '', site: r[1] || '', role: r[2] || '', company: r[3] || '',
      salary: r[4] || '', skills: r[5] || '', link: r[6] || '', jd: r[7] || '',
    });
  }
  // Make Job Link a real hyperlink so Excel shows it as clickable
  const linkCol = COLUMNS.findIndex((c) => c.key === 'link') + 1;
  ws.eachRow({ includeEmpty: false }, (row, idx) => {
    if (idx === 1) return;
    const cell = row.getCell(linkCol);
    const url = String(cell.value || '').trim();
    if (/^https?:\/\//i.test(url)) {
      cell.value = { text: url, hyperlink: url };
      cell.font = { color: { argb: 'FF1F6FEB' }, underline: true };
    }
  });

  await wb.xlsx.writeFile(XLSX_FILE);
  console.log(`✅ Wrote ${dataRows.length} row(s) to ${path.basename(XLSX_FILE)}`);
})();
