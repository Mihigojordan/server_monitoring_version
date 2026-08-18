import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import AppShell from '../../components/layout/AppShell'
import { useApp } from '../../context/AppContext'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'
import NormalSaleReceipt from '../../components/receipts/NormalSaleReceipt'
import TrainingSaleReceipt from '../../components/receipts/TrainingSaleReceipt'
import ProformaSaleReceipt from '../../components/receipts/ProformaSaleReceipt'
import CopySaleReceipt from '../../components/receipts/CopySaleReceipt'
import RefundSaleReceipt from '../../components/receipts/RefundSaleReceipt'
import A4InvoiceTemplate from '../../components/receipts/A4InvoiceTemplate'
import A4CopyReceipt from '../../components/receipts/A4CopyReceipt'
import A4RefundReceipt from '../../components/receipts/A4RefundReceipt'

const PAYMENT_METHODS = [
  { v: '01', l: 'Cash' }, { v: '02', l: 'Credit' }, { v: '03', l: 'Cash/Credit' },
  { v: '04', l: 'Bank Cheque' }, { v: '05', l: 'Debit/Credit Card' },
  { v: '06', l: 'Mobile Money' }, { v: '07', l: 'Other' },
]
const REFUND_REASONS = [
  { v: '01', l: 'Missing quantity' }, { v: '02', l: 'Missing item' },
  { v: '03', l: 'Damaged goods' }, { v: '04', l: 'Wasted goods' },
  { v: '05', l: 'Raw material shortage' }, { v: '06', l: 'General refund' },
  { v: '07', l: 'Wrong customer TIN' }, { v: '08', l: 'Wrong customer name' },
  { v: '09', l: 'Wrong amount/price' }, { v: '10', l: 'Wrong quantity' },
  { v: '11', l: 'Wrong items' }, { v: '12', l: 'Wrong tax type' }, { v: '13', l: 'Other' },
]

// CIS spec §7.24.7 — QR payload: invoice_date(ddmmyyyy)#time(hhmmss)#sdc_number#sdc_receipt_number#internal_data#receipt_signature
function formatQrDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`
}
function formatQrTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
}

function toEbmDate(isoStr) {
  const d = new Date(isoStr || Date.now())
  return {
    year:   String(d.getFullYear()),
    month:  String(d.getMonth() + 1).padStart(2, '0'),
    day:    String(d.getDate()).padStart(2, '0'),
    hour:   String(d.getHours()).padStart(2, '0'),
    minute: String(d.getMinutes()).padStart(2, '0'),
    second: String(d.getSeconds()).padStart(2, '0'),
  }
}

function SaleLabel({ saleType, receiptType }) {
  const label = `${saleType}${receiptType}`
  const colors = { NS: 'chip--ok', NR: 'chip--warn', CS: 'chip--info', CR: 'chip--warn', TS: 'chip--brand', TR: 'chip--warn', PS: 'chip--brand', RS: 'chip--danger' }
  return <span className={`chip ${colors[label] || ''}`}>{label}</span>
}

export default function Invoice() {
  const navigate = useNavigate()
  const { rawUser } = useApp()

  const [sales,    setSales]    = useState([])
  const [meta,     setMeta]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [tab,      setTab]      = useState('All')
  const [counters, setCounters] = useState(null)

  const [findId,      setFindId]      = useState('')
  const [findLoading, setFindLoading] = useState(false)

  const [branchId,      setBranchId]      = useState('')
  const [branchSales,   setBranchSales]   = useState([])
  const [branchLoading, setBranchLoading] = useState(false)

  const [refundSale,   setRefundSale]   = useState(null)
  const [refundForm,   setRefundForm]   = useState({ refundReason: '06', itemsReceived: 'Y', purchaseCode: '', stockReleaseDate: '', itemSequences: '' })
  const [refundSaving, setRefundSaving] = useState(false)
  const [refundErr,    setRefundErr]    = useState(null)
  const [lockChecking, setLockChecking] = useState(false)

  const [receiptSale,  setReceiptSale]  = useState(null)
  const [receiptExtra, setReceiptExtra] = useState(null)
  const [receiptMode,  setReceiptMode]  = useState('Thermal')
  const [pdfSaving,    setPdfSaving]    = useState(false)

  function openReceipt(sale) {
    setReceiptSale(sale)
    // Extract MRC, SDC info from sale's ebmSaleData if available
    const receiptData = {
      mrcNo: sale.ebmSaleData?.mrcNo || sale.mrcNo || '—',
      sdcId: sale.ebmSaleData?.sdcId || sale.sdcId || '—',
      internalData: sale.ebmSaleData?.intrlData || sale.intrlData || sale.ebmSaleData?.internalData || '—',
      signature: sale.ebmSaleData?.rcptSign || sale.signature || '—',
    }
    console.log('Receipt sale data:', { mrc: receiptData.mrcNo, sdc: receiptData.sdcId, sig: receiptData.signature })
    setReceiptExtra(receiptData)
  }

  const load = useCallback(async (page = 1) => {
    setLoading(true); setError(null)
    try {
      const res = await operatorApi.listSales(page)
      const data = res?.data ?? res ?? []
      setSales(Array.isArray(data) ? data : data?.data ?? [])
      setMeta(res?.meta ?? null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { operatorApi.receiptCounters().then(setCounters).catch(() => {}) }, [])

  async function checkLockAndRefund(s) {
    setLockChecking(true)
    try {
      const r = await operatorApi.lockCheck(s.id)
      if (r?.locked) { alert(`Sale #${s.invoiceNo} is locked and cannot be refunded.`); return }
    } catch { /* ignore */ }
    finally { setLockChecking(false) }
    setRefundSale(s)
    setRefundForm({ refundReason: '06', itemsReceived: 'Y', purchaseCode: '', stockReleaseDate: '', itemSequences: '' })
    setRefundErr(null)
  }

  async function handleRefund(e) {
    e.preventDefault(); setRefundErr(null); setRefundSaving(true)
    try {
      const now = new Date().toISOString()
      const payload = {
        saleId: refundSale.id,
        refundReason: refundForm.refundReason,
        itemsReceived: refundForm.itemsReceived,
        stockReleaseDate: toEbmDate(refundForm.stockReleaseDate || now),
        confirmationDate: toEbmDate(now),
      }
      if (refundForm.purchaseCode) payload.purchaseCode = refundForm.purchaseCode
      if (refundForm.itemSequences.trim()) {
        payload.itemSequences = refundForm.itemSequences.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
      }
      const res = await operatorApi.refundSale(payload)
      logActivity({ action: 'REFUND_SALE', category: 'System', summary: `Refunded sale #${refundSale.invoiceNo}` })
      setRefundSale(null); load()
      if (res?.id) openReceipt(res)
    } catch (err) {
      setRefundErr(err.data?.errors?.[0]?.message || err.message)
    } finally { setRefundSaving(false) }
  }

  async function handleFind(e) {
    e.preventDefault()
    if (!findId.trim()) return
    setFindLoading(true)
    try {
      const res = await operatorApi.findSale(findId.trim())
      if (res) openReceipt(res)
      else alert('Sale not found')
    } catch (err) { alert(err.message) }
    finally { setFindLoading(false) }
  }

  async function loadBranchSales() {
    if (!branchId.trim()) return
    setBranchLoading(true)
    try {
      const res = await operatorApi.branchTransactions(branchId.trim())
      setBranchSales(Array.isArray(res) ? res : res?.data ?? [])
    } catch (err) { alert(err.message) }
    finally { setBranchLoading(false) }
  }

  async function handleCopy(sale) {
    try {
      const res = await operatorApi.copySale({
        orginalInvoiceNo: sale.invoiceNo,
        purchaseCode: sale.purchaseCode || undefined,
        confirmationDate: toEbmDate(new Date().toISOString()),
      })
      logActivity({ action: 'COPY_SALE', category: 'System', summary: `Copied sale #${sale.invoiceNo} → new #${res.invoiceNo}` })
      load()
      if (res?.id) openReceipt(res)
    } catch (err) { alert(err.message) }
  }

  function printReceipt() {
    if (!receiptSale) return
    // Print the already-rendered #receipt-content in place (via @media print rules below)
    // instead of cloning markup into a popup window — the popup approach lost styles/images
    // due to document.write() timing and produced blank pages.
    window.print()
  }

  async function downloadReceiptPdf() {
    if (!receiptSale) return
    const node = document.getElementById('receipt-content')
    if (!node) return
    setPdfSaving(true)
    try {
      // #receipt-content is normally capped at max-height:90vh with overflow-y:auto so it fits
      // on screen; html2canvas only captures what's actually laid out, so a tall receipt would
      // get clipped to the scrolled-into-view portion. pdfSaving=true (below) removes that cap
      // via the inline style — wait two frames so the browser has reflowed/painted before capturing.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        height: node.scrollHeight,
        windowHeight: node.scrollHeight,
      })
      const imgData = canvas.toDataURL('image/png')
      const pxToMm = px => (px * 25.4) / (96 * 2) // canvas rendered at scale 2, screen is 96dpi
      const pdfWidth = pxToMm(canvas.width)
      const pdfHeight = pxToMm(canvas.height)
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      })
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`invoice-${receiptSale.invoiceNo}.pdf`)
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message)
    } finally {
      setPdfSaving(false)
    }
  }

  const filtered = tab === 'By Branch'
    ? branchSales
    : sales.filter(s => {
        if (tab === 'Normal')   return s.saleType === 'N'
        if (tab === 'Training') return s.saleType === 'T'
        if (tab === 'Proforma') return s.saleType === 'P'
        if (tab === 'Refunds')  return s.receiptType === 'R'
        return true
      })

  const total       = meta?.total ?? sales.length
  const totalPages  = meta ? meta.lastPage ?? Math.ceil(meta.total / 12) : 1
  const currentPage = meta?.page ?? 1

  const qrData = receiptSale
    ? [
        formatQrDate(receiptSale.saleDate),
        formatQrTime(receiptSale.confirmationDate),
        receiptExtra?.sdcId || receiptSale.ebmSaleData?.sdcId || '',
        receiptSale.ebmSaleData?.rcptNo ?? receiptSale.invoiceNo,
        receiptExtra?.internalData || receiptSale.ebmSaleData?.intrlData || '',
        receiptExtra?.signature || receiptSale.ebmSaleData?.rcptSign || '',
      ].join('#')
    : ''
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Invoices</span></div>
            <h1>Sales &amp; Invoices</h1>
          </div>
          <div className="page-head__actions">
            <form onSubmit={handleFind} style={{ display: 'flex', gap: 6 }}>
              <input className="form-input form-input--sm input--mono" placeholder="Find by sale ID…"
                value={findId} onChange={e => setFindId(e.target.value)} style={{ width: 160 }} />
              <button type="submit" className="btn btn--sm" disabled={findLoading}>
                {findLoading ? '…' : 'Find'}
              </button>
            </form>
            <button className="btn"
              onClick={() => operatorApi.lastReceipt().then(r => alert(`Last receipt: #${r.invoiceNo}`)).catch(e => alert(e.message))}>
              Last Receipt
            </button>
            <button className="btn btn--primary" onClick={() => navigate('/invoice/new')}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              New Invoice
            </button>
          </div>
        </div>

        {rawUser?.isTrainingMode && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px',
            background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10,
            marginBottom: 20, fontSize: 13, color: '#92400e', fontWeight: 600,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', background: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: 999 }}>
              Training Mode
            </span>
            <span style={{ fontWeight: 400 }}>
              New invoices are issued as Training (TS) receipts with no tax impact until this is turned off in Settings.
            </span>
          </div>
        )}

        {/* KPI counters */}
        {counters && (
          <div className="kpi-grid">
            <div className="kpi"><div className="kpi__label">Sales (NS)</div><div className="kpi__value">{counters.lastSaleInvoiceNo ?? 0}</div><span className="kpi__sub">last invoice no</span></div>
            <div className="kpi"><div className="kpi__label">Training (TS)</div><div className="kpi__value">{counters.lastTrainingInvoiceNo ?? 0}</div><span className="kpi__sub">last training no</span></div>
            <div className="kpi"><div className="kpi__label">Proforma (PS)</div><div className="kpi__value">{counters.lastProformaInvoiceNo ?? 0}</div><span className="kpi__sub">last proforma no</span></div>
            <div className="kpi"><div className="kpi__label">Copies (CS)</div><div className="kpi__value">{counters.lastCopyInvoiceNo ?? 0}</div><span className="kpi__sub">last copy no</span></div>
          </div>
        )}

        {/* Refund modal */}
        {refundSale && (
          <div className="modal-backdrop" onClick={() => setRefundSale(null)}>
            <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
              <div className="modal__head">
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Refund</div>
                  <h3 style={{ margin: 0 }}>Invoice #{refundSale.invoiceNo}</h3>
                </div>
                <button className="modal__close" onClick={() => setRefundSale(null)} aria-label="Close">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
                </button>
              </div>
              <div className="modal__body">
                {refundErr && <div className="settings-error">{refundErr}</div>}
                <form onSubmit={handleRefund}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="refReason">Refund Reason *</label>
                    <select id="refReason" className="form-input" value={refundForm.refundReason}
                      onChange={e => setRefundForm(f => ({ ...f, refundReason: e.target.value }))}>
                      {REFUND_REASONS.map(r => <option key={r.v} value={r.v}>{r.v} — {r.l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="refItemsRec">Items Physically Returned? *</label>
                    <select id="refItemsRec" className="form-input" value={refundForm.itemsReceived}
                      onChange={e => setRefundForm(f => ({ ...f, itemsReceived: e.target.value }))}>
                      <option value="Y">Yes (Y)</option>
                      <option value="N">No (N)</option>
                    </select>
                  </div>
                  {refundSale.customerTin && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="refPurchCode">Purchase Code (6 chars)</label>
                      <input id="refPurchCode" className="form-input input--mono" maxLength={6} value={refundForm.purchaseCode}
                        onChange={e => setRefundForm(f => ({ ...f, purchaseCode: e.target.value }))} />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label" htmlFor="refStockDate">Stock Release Date/Time</label>
                    <input id="refStockDate" type="datetime-local" className="form-input"
                      value={refundForm.stockReleaseDate}
                      onChange={e => setRefundForm(f => ({ ...f, stockReleaseDate: e.target.value }))} />
                    <span className="form-hint">Leave blank to use current time</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="refItemSeq">Item Sequences (partial refund)</label>
                    <input id="refItemSeq" className="form-input input--mono" placeholder="e.g. 1, 3 — blank = full refund"
                      value={refundForm.itemSequences}
                      onChange={e => setRefundForm(f => ({ ...f, itemSequences: e.target.value }))} />
                    <span className="form-hint">Comma-separated line item numbers to refund partially</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button type="submit" className="btn btn--danger" disabled={refundSaving}>{refundSaving ? 'Processing…' : 'Issue Refund'}</button>
                    <button type="button" className="btn" onClick={() => setRefundSale(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Receipt modal */}
        {receiptSale && (
          <div
            className="modal-backdrop"
            onClick={() => setReceiptSale(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              animation: 'fadeIn 0.3s ease-in-out',
              // 'visible' while capturing so a tall receipt isn't clipped by this fixed,
              // viewport-height backdrop when html2canvas renders it off-screen for the PDF.
              overflowY: pdfSaving ? 'visible' : 'auto'
            }}
          >
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideUp {
                from {
                  opacity: 0;
                  transform: translateY(20px) scale(0.95);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }

              @page thermal-page { size: 80mm auto; margin: 0; }
              @page a4-page { size: A4; margin: 10mm; }
              #receipt-content.print-thermal { page: thermal-page; }
              #receipt-content.print-a4 { page: a4-page; }

              @media print {
                body * { visibility: hidden !important; }
                #receipt-content, #receipt-content * { visibility: visible !important; }

                .modal-backdrop {
                  position: static !important;
                  display: block !important;
                  background: none !important;
                  overflow: visible !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  animation: none !important;
                }
                .receipt-modal-frame {
                  position: static !important;
                  display: block !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  animation: none !important;
                }
                #receipt-content {
                  position: static !important;
                  max-height: none !important;
                  overflow: visible !important;
                  box-shadow: none !important;
                  border-radius: 0 !important;
                  margin: 0 !important;
                }
                .no-print { display: none !important; }
              }
            `}</style>
            <div
              className="receipt-modal-frame"
              style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px 20px',
                animation: 'slideUp 0.4s ease-out'
              }}
              onClick={e => e.stopPropagation()}
            >

              {/* Floating Print / PDF Buttons */}
              <div className="no-print" style={{ position: 'fixed', top: 70, right: 20, zIndex: 1001, display: 'flex', gap: 8 }}>
                <button
                  className="btn btn--primary"
                  onClick={printReceipt}
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                >
                  🖨️ Print
                </button>
                <button
                  className="btn btn--primary"
                  onClick={downloadReceiptPdf}
                  disabled={pdfSaving}
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                >
                  {pdfSaving ? 'Preparing…' : '⬇️ Download PDF'}
                </button>
              </div>

              {/* Template Switcher */}
              <div
                className="no-print"
                style={{
                  position: 'fixed',
                  top: 20,
                  left: 20,
                  zIndex: 1001,
                  display: 'flex',
                  gap: 8,
                  background: 'rgba(255,255,255,0.95)',
                  borderRadius: '8px',
                  padding: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                <button
                  onClick={() => setReceiptMode('Thermal')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: receiptMode === 'Thermal' ? 700 : 400,
                    background: receiptMode === 'Thermal' ? '#0055A4' : '#e5e7eb',
                    color: receiptMode === 'Thermal' ? '#fff' : '#333',
                    fontSize: '13px',
                  }}
                >
                  Thermal 80mm
                </button>
                {receiptSale?.saleType !== 'T' && receiptSale?.saleType !== 'P' && (
                  <button
                    onClick={() => setReceiptMode('A4')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: receiptMode === 'A4' ? 700 : 400,
                      background: receiptMode === 'A4' ? '#0055A4' : '#e5e7eb',
                      color: receiptMode === 'A4' ? '#fff' : '#333',
                      fontSize: '13px',
                    }}
                  >
                    A4 Invoice
                  </button>
                )}
              </div>

              {/* Close Button */}
              <button
                className="no-print"
                onClick={() => setReceiptSale(null)}
                style={{
                  position: 'fixed',
                  top: 20,
                  right: 20,
                  zIndex: 1001,
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  fontSize: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>

              <div
                id="receipt-content"
                className={receiptMode === 'Thermal' ? 'print-thermal' : 'print-a4'}
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                  overflow: pdfSaving ? 'visible' : 'hidden',
                  padding: '0',
                  maxHeight: pdfSaving ? 'none' : '90vh',
                  overflowY: pdfSaving ? 'visible' : 'auto'
                }}
              >
                {receiptMode === 'Thermal' ? (
                  receiptSale?.saleType === 'C'
                    ? <CopySaleReceipt receiptSale={receiptSale} receiptExtra={receiptExtra} qrUrl={qrUrl}/>
                    : receiptSale?.receiptType === 'R'
                      ? <RefundSaleReceipt receiptSale={receiptSale} receiptExtra={receiptExtra} qrUrl={qrUrl}/>
                      : receiptSale?.saleType === 'T'
                        ? <TrainingSaleReceipt receiptSale={receiptSale} receiptExtra={receiptExtra} qrUrl={qrUrl}/>
                        : receiptSale?.saleType === 'P'
                          ? <ProformaSaleReceipt receiptSale={receiptSale} receiptExtra={receiptExtra} qrUrl={qrUrl}/>
                          : <NormalSaleReceipt receiptSale={receiptSale} receiptExtra={receiptExtra} qrUrl={qrUrl}/>
                ) : receiptSale?.saleType === 'C' ? (
                  <A4CopyReceipt
                    receiptSale={receiptSale}
                    receiptExtra={receiptExtra}
                    qrUrl={qrUrl}
                    businessName={rawUser?.taxPayerName}
                    businessAddress={rawUser?.address}
                    businessPhone={rawUser?.phoneNumber || rawUser?.phone}
                    businessEmail={rawUser?.email}
                    businessTin={rawUser?.tin}
                    businessLogoUrl={rawUser?.image?.url || rawUser?.imageLink}
                  />
                ) : receiptSale?.receiptType === 'R' ? (
                  <A4RefundReceipt
                    receiptSale={receiptSale}
                    receiptExtra={receiptExtra}
                    qrUrl={qrUrl}
                    businessName={rawUser?.taxPayerName}
                    businessAddress={rawUser?.address}
                    businessPhone={rawUser?.phoneNumber || rawUser?.phone}
                    businessEmail={rawUser?.email}
                    businessTin={rawUser?.tin}
                    businessLogoUrl={rawUser?.image?.url || rawUser?.imageLink}
                  />
                ) : (
                  <A4InvoiceTemplate
                    receiptSale={receiptSale}
                    receiptExtra={receiptExtra}
                    qrUrl={qrUrl}
                    businessName={rawUser?.taxPayerName}
                    businessAddress={rawUser?.address}
                    businessPhone={rawUser?.phoneNumber || rawUser?.phone}
                    businessEmail={rawUser?.email}
                    businessTin={rawUser?.tin}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sales table */}
        <div className="card">
          <div className="filterbar">
            <div className="tab-bar">
              {['All', 'Normal', 'Training', 'Proforma', 'Refunds', 'By Branch'].map(t => (
                <button key={t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            {tab === 'By Branch' && (
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
                <input className="form-input form-input--sm input--mono" placeholder="Branch ID (e.g. 00)"
                  value={branchId} onChange={e => setBranchId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadBranchSales()} style={{ width: 160 }} />
                <button className="btn btn--sm btn--primary" onClick={loadBranchSales} disabled={branchLoading}>
                  {branchLoading ? 'Loading…' : 'Load'}
                </button>
              </div>
            )}
          </div>

          <div className="table-wrap">
            {error && <div className="settings-error" style={{ margin: 16 }}>{error}</div>}
            {(loading && tab !== 'By Branch') || (branchLoading && tab === 'By Branch') ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)' }}>
                {tab === 'By Branch' ? 'Loading branch transactions…' : 'Loading invoices…'}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
                No invoices found.
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn--primary btn--sm" onClick={() => navigate('/invoice/new')}>Create First Invoice</button>
                </div>
              </div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Type</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th className="num">Total</th>
                    <th className="num">VAT</th>
                    <th>Date</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.invoiceNo}</span></td>
                      <td><SaleLabel saleType={s.saleType} receiptType={s.receiptType} /></td>
                      <td style={{ fontSize: 13 }}>
                        <div>{s.customerName || 'Walk-in'}</div>
                        {s.customerTin && <div style={{ fontSize: 11.5, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{s.customerTin}</div>}
                      </td>
                      <td style={{ fontSize: 12.5 }}>{PAYMENT_METHODS.find(p => p.v === s.paymentMethod)?.l || s.paymentMethod}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{Number(s.totalAmount || 0).toLocaleString()}</td>
                      <td className="num" style={{ color: 'var(--ink-600)' }}>{Number(s.totalTaxAmount || 0).toLocaleString()}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{s.saleDate ? new Date(s.saleDate).toLocaleDateString() : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn--sm" onClick={() => openReceipt(s)}>View</button>
                          {s.receiptType !== 'R' && s.saleType !== 'P' && s.saleType !== 'T' && (
                            <button className="btn btn--sm btn--danger" onClick={() => checkLockAndRefund(s)} disabled={lockChecking}>Refund</button>
                          )}
                          {s.saleType === 'N' && s.receiptType === 'S' && (
                            <button className="btn btn--sm" onClick={() => handleCopy(s)}>Copy</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!loading && tab !== 'By Branch' && totalPages > 1 && (
            <div className="pagination">
              <span>Showing {((currentPage - 1) * 12) + 1}–{Math.min(currentPage * 12, total)} of {total}</span>
              <div className="pages">
                <button onClick={() => load(currentPage - 1)} disabled={currentPage <= 1}>‹</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                  <button key={p} className={p === currentPage ? 'is-active' : ''} onClick={() => load(p)}>{p}</button>
                ))}
                <button onClick={() => load(currentPage + 1)} disabled={currentPage >= totalPages}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
