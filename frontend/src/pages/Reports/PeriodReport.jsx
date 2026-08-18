import { useState } from 'react'
import { operatorApi } from '../../api/operator'
import ReportLayout, { ReportCard, useReport, today, monthStart, DateField } from './ReportLayout'

export default function PeriodReport() {
  const [from, setFrom] = useState(monthStart())
  const [to,   setTo]   = useState(today())
  const r = useReport(() => operatorApi.periodReport(from, to))

  return (
    <ReportLayout title="Period Report" url={r.url}>
      <ReportCard
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round"/></svg>}
        title="Custom Period Summary"
        desc="Analyze sales performance across a custom date range. This comprehensive report aggregates totals, tax categories, and itemized sales metrics."
        badge={{ label: 'Period', variant: 'brand' }}
        filename={`period-report-${from}-${to}.pdf`}
        {...r}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <DateField label="Start Date" value={from} onChange={setFrom} />
          <DateField label="End Date"   value={to}   onChange={setTo} />
        </div>
        <button className="btn btn--primary" style={{ width: '100%', height: 44, borderRadius: 10, fontSize: 15, marginTop: 8 }} onClick={() => r.run()} disabled={r.loading}>
          {r.loading ? 'Generating...' : 'Generate Period Report'}
        </button>
      </ReportCard>
    </ReportLayout>
  )
}
