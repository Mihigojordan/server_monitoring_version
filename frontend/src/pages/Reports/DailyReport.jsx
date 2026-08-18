import { useState } from 'react'
import { operatorApi } from '../../api/operator'
import ReportLayout, { ReportCard, useReport, today, DateField } from './ReportLayout'

export default function DailyReport() {
  const [date, setDate] = useState(today())
  const r = useReport(() => operatorApi.dailyReport(date))
  
  return (
    <ReportLayout title="Daily Report" url={r.url}>
      <ReportCard
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>}
        title="End of Day Summary"
        desc="Generate a full sales summary for a specific business date. Includes total sales, tax breakdowns (A-D), and payment method distribution."
        badge={{ label: 'Daily', variant: 'ok' }}
        filename={`daily-report-${date}.pdf`}
        {...r}
      >
        <DateField label="Select Business Date" value={date} onChange={setDate} />
        <button className="btn btn--primary" style={{ width: '100%', height: 44, borderRadius: 10, fontSize: 15, marginTop: 8 }} onClick={() => r.run()} disabled={r.loading}>
          {r.loading ? 'Generating...' : 'Generate Daily Report'}
        </button>
      </ReportCard>
    </ReportLayout>
  )
}
