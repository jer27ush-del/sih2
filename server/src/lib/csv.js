// CSV export helpers. Values that could be read as formulas are neutralised to protect spreadsheet users.
import { pendingHandoff } from './workflow.js';
import { slaStateOf } from './monitor.js';

const FORMULA_START = /^[=+\-@\t\r]/;

export function cell(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Byte-order mark first, so Excel opens accented names correctly.
export function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export const CASE_HEADERS = [
  'Case ID',
  'Institution',
  'AICTE ID',
  'Region',
  'Category',
  'Priority',
  'Status',
  'Lead cell',
  'Awaiting acknowledgement by',
  'Deadline status',
  'Due date',
  'Received',
  'Similarity',
  'Coordination needed',
];

export function caseRow(c, now = new Date()) {
  return [
    c.caseId,
    c.institution?.name,
    c.institution?.aicteId,
    c.institution?.region,
    c.category,
    c.priority,
    c.status,
    c.leadBureau?.code ?? 'Unassigned',
    pendingHandoff(c.actions ?? [])?.toCode ?? '',
    slaStateOf(c, now),
    c.dueDate,
    c.receivedAt,
    c.dnaLabel,
    c.overlap ? 'Yes' : 'No',
  ];
}
