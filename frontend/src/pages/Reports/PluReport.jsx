import { useState } from 'react'
import { operatorApi } from '../../api/operator'
import ReportLayout, { ReportCard, useReport, today, monthStart, DateField } from './ReportLayout'

export default function PluReport() {
  const [from, setFrom] = useState(monthStart())
  const [to,   setTo]   = useState(today())
  const r = useReport(() => operatorApi.pluReport(from, to))

  return (
    <ReportLayout title="PLU Report" url={r.url}>
      <ReportCard
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 6h14M9 21a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM19 21a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        title="Sales by Item (PLU)"
        desc="Item-level sales performance report. Tracks quantity sold, revenue, and tax per individual product code (PLU) for the selected period."
        badge={{ label: 'Per Item', variant: 'info' }}
        filename={`plu-report-${from}-${to}.pdf`}
        {...r}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <DateField label="Start Date" value={from} onChange={setFrom} />
          <DateField label="End Date"   value={to}   onChange={setTo} />
        </div>
        <button className="btn btn--primary" style={{ width: '100%', height: 44, borderRadius: 10, fontSize: 15, marginTop: 8 }} onClick={() => r.run()} disabled={r.loading}>
          {r.loading ? 'Generating...' : 'Generate PLU Report'}
        </button>
      </ReportCard>
    </ReportLayout>
  )
}
