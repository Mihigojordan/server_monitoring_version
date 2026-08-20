import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function cellValue(row, col) {
  const v = col.get ? col.get(row) : row[col.key]
  return v == null || v === '' ? '—' : v
}

// columns: [{ key, label, get?: (row) => value }]
export function exportToCSV(rows, columns, filename) {
  const header = columns.map(c => csvEscape(c.label)).join(',')
  const body = rows.map(row => columns.map(c => csvEscape(cellValue(row, c))).join(',')).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  triggerBlobDownload(blob, filename)
}

export function exportToExcel(rows, columns, filename, sheetName = 'Report') {
  const data = rows.map(row => {
    const obj = {}
    columns.forEach(c => { obj[c.label] = cellValue(row, c) })
    return obj
  })
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename)
}

export function exportToPdf(rows, columns, filename, title) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: columns.length > 5 ? 'landscape' : 'portrait' })
  const marginX = 40
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const colWidth = (pageWidth - marginX * 2) / columns.length
  let y = 50

  pdf.setFontSize(16)
  pdf.setTextColor(20)
  pdf.text(title, marginX, y)
  y += 18
  pdf.setFontSize(9)
  pdf.setTextColor(120)
  pdf.text(`Generated ${new Date().toLocaleString()} · ${rows.length} record${rows.length === 1 ? '' : 's'}`, marginX, y)
  y += 24

  function drawHeader() {
    pdf.setFont(undefined, 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(30)
    columns.forEach((c, i) => pdf.text(String(c.label), marginX + i * colWidth, y, { maxWidth: colWidth - 6 }))
    y += 8
    pdf.setDrawColor(200)
    pdf.line(marginX, y, pageWidth - marginX, y)
    y += 14
    pdf.setFont(undefined, 'normal')
  }

  drawHeader()
  rows.forEach(row => {
    if (y > pageHeight - 50) { pdf.addPage(); y = 50; drawHeader() }
    columns.forEach((c, i) => {
      const text = String(cellValue(row, c))
      pdf.text(text, marginX + i * colWidth, y, { maxWidth: colWidth - 6 })
    })
    y += 16
  })

  pdf.save(filename)
}
