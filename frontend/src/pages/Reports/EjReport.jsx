import { useState } from 'react'
import { operatorApi } from '../../api/operator'
import ReportLayout, { ReportCard, useReport, today, monthStart, DateField } from './ReportLayout'

export default function EjReport() {
  const [from, setFrom] = useState(monthStart())
  const [to,   setTo]   = useState(today())
  const r = useReport(() => operatorApi.ejReport(from, to, 1))

  return (
    <ReportLayout title="Electronic Journal" url={r.url}>
      <ReportCard
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M4 6h16M4 10h16M4 14h10M4 18h6" strokeLinecap="round"/></svg>}
        title="Transaction Audit Log"
        desc="Access the complete Electronic Journal for a specific period. This provides a detailed audit trail of every invoice issued, including voided ones."
        badge={{ label: 'Audit', variant: 'warn' }}
        filename={`ej-report-${from}-${to}.pdf`}
        {...r}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <DateField label="Start Date" value={from} onChange={setFrom} />
          <DateField label="End Date"   value={to}   onChange={setTo} />
        </div>
        <button className="btn btn--primary" style={{ width: '100%', height: 44, borderRadius: 10, fontSize: 15, marginTop: 8 }} onClick={() => r.run()} disabled={r.loading}>
          {r.loading ? 'Generating...' : 'Generate EJ Report'}
        </button>
      </ReportCard>
    </ReportLayout>
  )
}
