// CSV export utility — generates UTF-8 BOM CSV for Excel Chinese compatibility

export interface CsvColumn {
  header: string
  key: string
  format?: (value: unknown) => string
}

export function generateCsv(columns: CsvColumn[], rows: Record<string, unknown>[]): string {
  const BOM = '﻿'

  const header = columns.map(c => `"${c.header}"`).join(',')

  const dataRows = rows.map(row =>
    columns
      .map(c => {
        const value = row[c.key]
        const formatted = c.format ? c.format(value) : String(value ?? '')
        // Escape quotes in cell values
        return `"${formatted.replace(/"/g, '""')}"`
      })
      .join(',')
  )

  return BOM + [header, ...dataRows].join('\n')
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
