import { useState } from 'react'
import { operatorApi } from '../../api/operator'
import ReportLayout, { ReportCard, useReport, today, monthStart, DateField } from './ReportLayout'

export default function PurchasesReport() {
  const [from, setFrom] = useState(monthStart())
  const [to,   setTo]   = useState(today())
  const r = useReport(() => operatorApi.purchasesReport(from, to))

  return (
    <ReportLayout title="Purchases Report" url={r.url}>
      <ReportCard
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M3 7h18l-2 13H5L3 7z M8 7V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        title="Supplier Purchase Summary"
        desc="Consolidated list of all supply purchases received. Includes supplier TINs, taxable amounts, and input VAT details for tax reconciliation."
        badge={{ label: 'Purchases', variant: 'brand' }}
        filename={`purchases-report-${from}-${to}.pdf`}
        {...r}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <DateField label="Start Date" value={from} onChange={setFrom} />
          <DateField label="End Date"   value={to}   onChange={setTo} />
        </div>
        <button className="btn btn--primary" style={{ width: '100%', height: 44, borderRadius: 10, fontSize: 15, marginTop: 8 }} onClick={() => r.run()} disabled={r.loading}>
          {r.loading ? 'Generating...' : 'Generate Purchases Report'}
        </button>
      </ReportCard>
    </ReportLayout>
  )
}
