import { useEffect, useState } from 'react'
import { operatorApi } from '../../api/operator'
import ReportLayout, { ReportCard, useReport, today, monthStart, DateField } from './ReportLayout'

export default function StockReport() {
  const [from, setFrom] = useState(monthStart())
  const [to,   setTo]   = useState(today())
  const [asOf, setAsOf] = useState(today())
  const [lastUrl, setLastUrl] = useState(null)

  const r  = useReport(() => operatorApi.stockReport(from, to))
  const cs = useReport(() => operatorApi.closingStockReport(asOf))

  // Update preview pane whenever a new PDF is generated
  useEffect(() => { if (r.url)  setLastUrl(r.url)  }, [r.url])
  useEffect(() => { if (cs.url) setLastUrl(cs.url) }, [cs.url])

  return (
    <ReportLayout title="Stock Reports" url={lastUrl}>
      <ReportCard
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        title="Inventory Flow Report"
        desc="Review all stock-in and stock-out events. Reconcile physical inventory with system records over any date range."
        badge={{ label: 'Inventory', variant: 'ok' }}
        filename={`stock-movement-${from}-${to}.pdf`}
        {...r}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <DateField label="Start Date" value={from} onChange={setFrom} />
          <DateField label="End Date"   value={to}   onChange={setTo} />
        </div>
        <button className="btn btn--primary" style={{ width: '100%', height: 44, borderRadius: 10, fontSize: 15, marginTop: 8 }} onClick={() => r.run()} disabled={r.loading}>
          {r.loading ? 'Generating...' : 'Generate Stock Report'}
        </button>
      </ReportCard>

      <ReportCard
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        title="Closing Stock by Date"
        desc="Point-in-time snapshot of every item's stock quantity as of a chosen date. Required by RRA CIS spec §7.31."
        badge={{ label: 'CIS §7.31', variant: 'ok' }}
        filename={`closing-stock-${asOf}.pdf`}
        {...cs}
      >
        <DateField label="Stock as of Date" value={asOf} onChange={setAsOf} />
        <button className="btn btn--primary" style={{ width: '100%', height: 44, borderRadius: 10, fontSize: 15, marginTop: 8 }} onClick={() => cs.run()} disabled={cs.loading}>
          {cs.loading ? 'Generating...' : 'Generate Closing Stock Report'}
        </button>
      </ReportCard>
    </ReportLayout>
  )
}
