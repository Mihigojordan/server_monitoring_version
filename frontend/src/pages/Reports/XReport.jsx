import { useState } from 'react'
import { operatorApi } from '../../api/operator'
import ReportLayout, { ReportCard, useReport, today } from './ReportLayout'

export default function XReport() {
  const r = useReport(() => operatorApi.xReport())
  return (
    <ReportLayout title="X-Report" url={r.url}>
      <ReportCard
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7M9 12l6 6M15 12l-6 6" strokeLinecap="round"/></svg>}
        title="Current Day Snapshot"
        desc="Generate an intraday summary of all transactions recorded since the start of the current business day. This report does not require a date range."
        badge={{ label: 'Intraday', variant: 'info' }}
        filename="x-report.pdf"
        {...r}
      >
        <button className="btn btn--primary" style={{ width: '100%', height: 44, borderRadius: 10, fontSize: 15 }} onClick={() => r.run()} disabled={r.loading}>
          {r.loading ? 'Generating...' : 'Generate X-Report'}
        </button>
      </ReportCard>
    </ReportLayout>
  )
}
