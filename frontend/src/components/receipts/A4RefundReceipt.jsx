// Dedicated A4 template for plain REFUND receipts (NR — a refund of a normal
// sale, not a copy). Follows document/refund-receipt-84.html exactly.
// Deliberately separate from A4CopyReceipt.jsx: no COPY banner, no "NOT AN
// OFFICIAL RECEIPT" notice (this is a real fiscal receipt, not a reprint),
// and the item table folds the tax designation into the Total cell instead
// of a dedicated column.
export default function A4RefundReceipt({ receiptSale, receiptExtra, qrUrl, businessName, businessPhone, businessEmail, businessAddress, businessTin, businessLogoUrl }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  const items = receiptSale.items?.data || []
  // §14 — refund receipts show only negative, refunded amounts. Display-only, doesn't
  // touch stored/EBM-submitted values. This component is only ever used for refunds.
  const fmt = (n) => (Number(n || 0) * -1).toLocaleString()

  const taxDes = (item) => {
    const type = item.taxationType
    if (type === 'A') return 'A-EX'
    const rateField = { B: 'taxRateB', C: 'taxRateC', D: 'taxRateD' }[type]
    const rate = rateField ? Number(receiptSale[rateField] || 0).toFixed(2) : '0.00'
    return `${type || '—'}-${rate}%`
  }

  return (
    <>
    <style>{`
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Courier New', Courier, monospace;
  font-size: 11px;
  background: #ccc;
  color: #000;
  display: flex;
  justify-content: center;
  padding: 20px 16px;
}

.receipt {
  width: 780px;
  padding: 20px 24px;
  border: 1px solid #ccc;
  background: #fff;
}

/* ── HEADER ── */
.header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  margin-bottom: 6px;
}

.header-left { font-size: 11px; line-height: 1.55; }
.header-left .company-name { font-weight: bold; font-size: 12px; }

.header-center { text-align: center; font-weight: bold; }

.header-center .refund-title {
  font-size: 26px;
  letter-spacing: 2px;
  line-height: 1.2;
}

.header-center .ref-line {
  font-size: 13px;
  margin-top: 4px;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.header-right {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
}

.header-right img.logo { width: 72px; height: 72px; object-fit: contain; }

.logo-placeholder {
  width: 72px;
  height: 72px;
  border: 2px solid #2a6a2a;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e8f5e8;
  color: #2a6a2a;
  font-size: 8px;
  font-weight: bold;
  text-align: center;
  line-height: 1.3;
}

.divider-eq { border: none; border-top: 2px solid #000; margin: 5px 0; }

/* ── CUSTOMER INFO ── */
.customer-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin: 6px 0;
}

.customer-info { font-size: 11px; line-height: 1.65; }
.customer-info span { font-weight: bold; }

.refund-notice {
  text-align: right;
  font-size: 11px;
  font-weight: bold;
  line-height: 1.5;
}

/* ── ITEMS TABLE ── */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 11px;
}

.items-table th {
  border: 1px solid #000;
  padding: 4px 6px;
  text-align: left;
  font-weight: bold;
  background: #fff;
  white-space: nowrap;
}

.items-table td {
  border: 1px solid #000;
  padding: 4px 6px;
  vertical-align: top;
}

.col-no    { width: 28px; text-align: center; }
.col-stock { width: 60px; }
.col-prod  { width: 165px; }
.col-batch { width: 100px; }
.col-exp   { width: 80px; }
.col-pkg   { width: 38px; }
.col-qty   { width: 36px; text-align: right; }
.col-price { width: 55px; text-align: right; }
.col-total { width: 130px; text-align: right; }

/* ── TOTALS ── */
.totals-section { display: flex; justify-content: flex-end; margin: 8px 0; }
.totals-table { font-size: 11px; line-height: 1.75; min-width: 280px; }
.totals-table td:first-child { padding-right: 20px; font-weight: bold; }
.totals-table td:last-child { text-align: right; font-weight: bold; }
.totals-divider td { border-top: 1px solid #000; padding-top: 3px; }

/* ── SDC / CIS SECTIONS ── */
.sdc-header, .cis-header {
  display: grid;
  grid-template-columns: 60px 1fr 60px;
  align-items: center;
  margin: 8px 0 4px;
}

.badge-logo {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: contain;
  justify-self: start;
}

.badge-logo.right { justify-self: end; }

.section-title { text-align: center; font-weight: bold; font-size: 12px; letter-spacing: 1px; }

.info-table {
  width: 50%;
  border-collapse: collapse;
  font-size: 11px;
  margin: 4px 0;
}

.info-table td { border: 1px solid #000; padding: 3px 8px; line-height: 1.45; }
.info-table td:first-child { font-weight: bold; width: 130px; white-space: nowrap; }

.qr-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: start;
}

.qr-row img { width: 90px; height: 90px; border: 1px solid #000; }

/* ── FOOTER ── */
.footer { text-align: center; margin-top: 10px; font-size: 11px; }
.footer .thanks { font-weight: bold; font-size: 12px; margin-bottom: 3px; }
.footer .generated { font-size: 10px; color: #333; }

@media print {
  body { background: #fff; padding: 0; }
  .receipt { border: none; }
}
    `}</style>

    <div className="receipt">

      {/* HEADER */}
      <div className="header">
        <div className="header-left">
          <div className="company-name">{businessName || receiptSale.registrantName}</div>
          <div>{businessAddress || receiptSale.receipt?.address || 'Kigali, Rwanda'}</div>
          {businessEmail && <div>{businessEmail}</div>}
          {businessPhone && <div>{businessPhone}</div>}
          <div>TIN N<sup>o</sup>: {businessTin || receiptSale.tin || '—'}</div>
        </div>
        <div className="header-center">
          <div className="refund-title">REFUND</div>
          <div className="ref-line">REF. NORMAL RECEIPT#: {receiptSale.originalInvoiceNo ?? '—'}</div>
        </div>
        <div className="header-right">
          {businessLogoUrl
            ? <img className="logo" src={businessLogoUrl} alt="Company Logo" />
            : <div className="logo-placeholder">{(businessName || receiptSale.registrantName || '').slice(0, 12) || 'LOGO'}</div>}
        </div>
      </div>

      <hr className="divider-eq" />

      {/* CUSTOMER INFO */}
      <div className="customer-row">
        <div className="customer-info">
          <div><span>Customer Name:</span> {receiptSale.customerName || '—'}</div>
          <div><span>Customer Mobile N<sup>o</sup>:</span> {receiptSale.customerMobileNo || '—'}</div>
        </div>
        <div className="refund-notice">
          REFUND IS APPROVED ONLY<br/>
          FOR ORIGINAL SALES RECEIPT
        </div>
      </div>

      {/* ITEMS TABLE */}
      <table className="items-table">
        <thead>
          <tr>
            <th className="col-no">N<sup>o</sup></th>
            <th className="col-stock">Stock Id</th>
            <th className="col-prod">Product</th>
            <th className="col-batch">Batch</th>
            <th className="col-exp">Expiry</th>
            <th className="col-pkg">Pkg.</th>
            <th className="col-qty">Qty.</th>
            <th className="col-price">Price</th>
            <th className="col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const hasDiscount = Number(item.discountRate) > 0
            return (
              <tr key={i}>
                <td className="col-no">{i + 1}</td>
                <td className="col-stock">{item.code || '—'}</td>
                <td className="col-prod">
                  {item.name}
                  {hasDiscount && <><br/>discount -{Number(item.discountRate)}% -{Number(item.discountAmount || 0).toLocaleString()}</>}
                </td>
                {/* Not captured on a sale record today — left blank rather than guessed */}
                <td className="col-batch"></td>
                <td className="col-exp"></td>
                <td className="col-pkg">{item.packageUnit || item.packagingUnitCode || '—'}</td>
                <td className="col-qty">{Number(item.quantity).toLocaleString()}</td>
                <td className="col-price">{Number(item.price).toLocaleString()}</td>
                <td className="col-total">{fmt(item.totalAmount ?? item.quantity * item.price)} {taxDes(item)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* TOTALS */}
      <div className="totals-section">
        <table className="totals-table">
          <tbody>
            <tr>
              <td>Total</td>
              <td>{fmt(receiptSale.totalAmount)}</td>
            </tr>
            {Number(receiptSale.taxableAmountA) !== 0 && (
              <tr>
                <td>Total A-EX</td>
                <td>{fmt(receiptSale.taxableAmountA)}</td>
              </tr>
            )}
            {Number(receiptSale.taxableAmountB) !== 0 && (
              <>
                <tr>
                  <td>Total B-{Number(receiptSale.taxRateB || 0).toFixed(2)}%</td>
                  <td>{fmt(receiptSale.taxableAmountB)}</td>
                </tr>
                <tr>
                  <td>Total Tax B</td>
                  <td>{fmt(receiptSale.taxAmountB)}</td>
                </tr>
              </>
            )}
            {Number(receiptSale.taxableAmountC) !== 0 && (
              <tr>
                <td>Total C-{Number(receiptSale.taxRateC || 0).toFixed(2)}%</td>
                <td>{fmt(receiptSale.taxableAmountC)}</td>
              </tr>
            )}
            {Number(receiptSale.taxableAmountD) !== 0 && (
              <tr>
                <td>Total D-{Number(receiptSale.taxRateD || 0).toFixed(2)}%</td>
                <td>{fmt(receiptSale.taxableAmountD)}</td>
              </tr>
            )}
            <tr>
              <td>Total Tax</td>
              <td>{fmt(receiptSale.totalTaxAmount)}</td>
            </tr>
            <tr className="totals-divider">
              <td>CASH</td>
              <td>{fmt(receiptSale.totalAmount)}</td>
            </tr>
            <tr>
              <td>ITEMS NUMBER</td>
              <td>{items.length}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <hr className="divider-eq" />

      {/* SDC INFORMATIONS */}
      <div className="sdc-header">
        <img className="badge-logo" src="/image.png" alt="RRA" />
        <div className="section-title">SDC INFORMATIONS</div>
        <img className="badge-logo right" src="/image.png" alt="RRA" />
      </div>

      <hr className="divider-eq" />

      <div className="qr-row">
        <table className="info-table">
          <tbody>
            <tr>
              <td>DATE</td>
              <td>{formatDate(receiptSale.saleDate)}</td>
            </tr>
            <tr>
              <td>TIME</td>
              <td>{formatTime(receiptSale.confirmationDate)}</td>
            </tr>
            <tr>
              <td>SDC ID</td>
              <td>{receiptExtra?.sdcId || receiptSale.ebmSaleData?.sdcId || '—'}</td>
            </tr>
            <tr>
              <td>RECEIPT NUMBER</td>
              <td>
                {receiptSale.invoiceNo}
                {receiptSale.ebmSaleData?.totRcptNo ? `/${receiptSale.ebmSaleData.totRcptNo}` : ''}
                {' '}{receiptSale.saleType}{receiptSale.receiptType}
              </td>
            </tr>
            <tr>
              <td>INTERNAL DATA</td>
              <td>{receiptExtra?.internalData || receiptSale.ebmSaleData?.intrlData || '—'}</td>
            </tr>
            <tr>
              <td>SIGNATURE</td>
              <td>{receiptExtra?.signature || receiptSale.ebmSaleData?.rcptSign || '—'}</td>
            </tr>
          </tbody>
        </table>
        {qrUrl && <img src={qrUrl} alt="QR Code" />}
      </div>

      <hr className="divider-eq" />

      {/* CIS INFORMATIONS */}
      <div className="cis-header">
       <div className="logo-placeholder">{(businessName || receiptSale.registrantName || '').slice(0, 12) || 'LOGO'}</div>
        <div className="section-title">CIS INFORMATIONS</div>
        <div className="logo-placeholder">{(businessName || receiptSale.registrantName || '').slice(0, 12) || 'LOGO'}</div>
      </div>

      <hr className="divider-eq" />

      <table className="info-table">
        <tbody>
          <tr>
            <td>RECEIPT NUMBER</td>
            <td>{receiptSale.invoiceNo}</td>
          </tr>
          <tr>
            <td>DATE</td>
            <td>{formatDate(receiptSale.saleDate)}</td>
          </tr>
          <tr>
            <td>TIME</td>
            <td>{formatTime(receiptSale.saleDate)}</td>
          </tr>
          <tr>
            <td>MRC</td>
            <td>{receiptExtra?.mrcNo || receiptSale.mrcNo || '—'}</td>
          </tr>
        </tbody>
      </table>

      <hr className="divider-eq" />

      {/* FOOTER */}
      <div className="footer">
        <div className="thanks">Thanks see you again!</div>
        <div className="generated">Generated by {businessName || receiptSale.registrantName} {businessPhone ? `(call: ${businessPhone})` : ''}</div>
      </div>

    </div>
    </>
  )
}
