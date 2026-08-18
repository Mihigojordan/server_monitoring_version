const PAYMENT_METHODS = [
  { v: '01', l: 'Cash' }, { v: '02', l: 'Credit' }, { v: '03', l: 'Cash/Credit' },
  { v: '04', l: 'Bank Cheque' }, { v: '05', l: 'Debit/Credit Card' },
  { v: '06', l: 'Mobile Money' }, { v: '07', l: 'Other' },
]

export default function A4InvoiceTemplate({ receiptSale, receiptExtra, qrUrl, businessName, businessPhone, businessEmail, businessAddress, businessTin }) {
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

  return (
    <>
    <style>{`
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: #ccc;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  padding: 40px 16px;
  font-family: 'Noto Sans', Arial, sans-serif;
  font-size: 11px;
  color: #111;
}

.page {
  background: #fff;
  width: 700px;
  padding: 32px 36px 28px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.18);
}

/* ── HEADER ── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.rra-logo { width: 72px; height: 72px; }
.rra-logo img { width: 100%; height: 100%; object-fit: contain; }

.company-center {
  text-align: center;
  flex: 1;
}

.logo-placeholder {
  font-size: 13px;
  font-weight: 700;
  color: #555;
  border: 1.5px dashed #aaa;
  display: inline-block;
  padding: 8px 20px;
  margin-bottom: 4px;
}

.rwanda-seal { width: 64px; height: 64px; }
.rwanda-seal img { width: 100%; height: 100%; object-fit: contain; }

/* ── COMPANY ADDRESS ── */
.company-address {
  text-align: center;
  font-size: 11px;
  line-height: 1.7;
  margin: 8px 0 14px;
  border-top: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
  padding: 6px 0;
}

/* ── INVOICE TO / INVOICE NO ── */
.invoice-meta {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.invoice-to {
  border: 1px solid #888;
  padding: 6px 10px;
  flex: 1;
  min-height: 60px;
}

.invoice-to-title {
  font-weight: 700;
  font-size: 10.5px;
  text-decoration: underline;
  margin-bottom: 4px;
}

.invoice-to-field {
  font-size: 10.5px;
  line-height: 1.7;
  color: #333;
}

.invoice-no-box {
  border: 1px solid #888;
  padding: 6px 10px;
  min-width: 200px;
  font-size: 10.5px;
  line-height: 1.8;
}

.invoice-no-box div { white-space: nowrap; }

/* ── ITEMS TABLE ── */
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0;
  border: 2px solid #000;
}

thead tr {
  background: #f0f0f0;
}

th {
  border-left: 1px solid #888;
  border-right: 1px solid #888;
  border-bottom: 1px solid #888;
  padding: 5px 7px;
  font-size: 11px;
  font-weight: 700;
  text-align: left;
}

th:first-child { border-left: none; }
th:last-child  { border-right: none; }

td {
  border-left: 1px solid #aaa;
  border-right: 1px solid #aaa;
  border-top: none;
  border-bottom: none;
  padding: 5px 7px;
  font-size: 11px;
  vertical-align: top;
}

td:first-child { border-left: none; }
td:last-child  { border-right: none; }

.col-no    { width: 34px; text-align: center; }
.col-code  { width: 110px; }
.col-desc  { }
.col-qty   { width: 44px; text-align: center; }
.col-tax   { width: 36px; text-align: center; }
.col-unit  { width: 80px; text-align: right; }
.col-total { width: 80px; text-align: right; }

.item-row td { height: 22px; }
.empty-row td { height: 20px; }

.item-discount {
  font-size: 10px;
  color: #666;
  margin-top: 2px;
}

.total-gross {
  font-size: 10px;
  color: #888;
  text-decoration: line-through;
}

/* ── BOTTOM SECTION ── */
.bottom {
  display: flex;
  gap: 16px;
  margin-top: 0;
  border-top: 1px solid #888;
  padding-top: 10px;
  align-items: flex-start;
}

/* Left: SDC + QR side by side */
.sdc-qr-wrap {
  display: flex;
  gap: 12px;
  flex: 1;
  align-items: flex-start;
}

.sdc-block {
  flex: 1;
  font-size: 10px;
  line-height: 1.65;
}

.sdc-title {
  font-weight: 700;
  font-size: 11px;
  margin-bottom: 4px;
  text-decoration: underline;
}

.sdc-field { color: #222; }

/* QR sits beside SDC text */
.qr-block {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
}

.qr-block img {
  width: 90px;
  height: 90px;
  border: 1px solid #000;
}

.cis-version {
  font-size: 9.5px;
  color: #555;
  margin-top: 8px;
}

/* Right: two separate bordered boxes stacked */
.right-boxes {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 230px;
}

/* Totals box */
.totals-box {
  border: 1px solid #888;
  font-size: 11px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #ccc;
}

.total-row:last-child { border-bottom: none; }

.total-label {
  padding: 6px 10px;
  font-weight: 600;
  border-right: 1px solid #aaa;
  flex: 1;
}

.total-value {
  padding: 6px 10px;
  min-width: 80px;
  text-align: right;
  font-weight: 600;
}

/* Payment box — separate bordered box below */
.payment-box {
  border: 1px solid #888;
  font-size: 11px;
}

.payment-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #ccc;
}

.payment-row:last-child { border-bottom: none; }

.payment-label {
  padding: 6px 10px;
  font-weight: 600;
  border-right: 1px solid #aaa;
  flex: 1;
}

.payment-value {
  padding: 6px 10px;
  font-weight: 700;
  min-width: 80px;
  text-align: right;
}
    `}</style>

    <div className="page">

      {/* HEADER */}
      <div className="header">

        {/* Company Logo */}
        <div className="rra-logo">
          <img src="/image.png" alt="Company Logo" />
        </div>

        {/* Company Address Section */}
        <div className="company-center">
          <div style={{ fontSize: '11px', lineHeight: '1.6', color: '#333' }}>
            <strong style={{ fontSize: '12px', display: 'block', marginBottom: '3px' }}>
              {businessName || receiptSale.registrantName}
            </strong>
            <div>{businessAddress || receiptSale.receipt?.address || 'Kigali, Rwanda'}</div>
            <div style={{ marginTop: '4px', fontSize: '10px' }}>
              TEL : {businessPhone || '—'} | EMAIL : {businessEmail || '—'} | TIN : {businessTin || receiptSale.tin || '—'}
            </div>
          </div>
        </div>

        {/* RRA Logo */}
        <div className="rwanda-seal">
          <img src="/rra_logo_2.png" alt="RRA Logo" />
        </div>
      </div>

      {/* Invoice To / Invoice No */}
      <div className="invoice-meta">
        <div className="invoice-to">
          <div className="invoice-to-title">INVOICE TO:</div>
          <div className="invoice-to-field">
            {receiptSale.customerTin && <div>TIN: {receiptSale.customerTin}</div>}
            {receiptSale.customerName && <div>Name: {receiptSale.customerName}</div>}
            <div>Phone: {receiptSale.customerMobileNo || '—'}</div>
          </div>
        </div>
        <div className="invoice-no-box">
          <div><strong>INVOICE NO : {receiptSale.invoiceNo}</strong></div>
          <div>Date : {formatDate(receiptSale.saleDate)} {formatTime(receiptSale.confirmationDate)}</div>
        </div>
      </div>

      {/* Items Table */}
      <table>
        <thead>
          <tr>
            <th className="col-no">No.</th>
            <th className="col-code">Item code</th>
            <th className="col-desc">Item Description</th>
            <th className="col-qty">Qty</th>
            <th className="col-tax">Tax</th>
            <th className="col-unit">Unit Price</th>
            <th className="col-total">Total Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const grossTotal = Number(item.quantity) * Number(item.price)
            const netTotal = Number(item.totalAmount ?? grossTotal)
            const hasDiscount = Number(item.discountRate) > 0
            return (
              <tr key={i} className="item-row">
                <td className="col-no">{i + 1}</td>
                <td className="col-code">{item.code || '—'}</td>
                <td className="col-desc">
                  {item.name}
                  {hasDiscount && <div className="item-discount">{Number(item.discountRate)}%</div>}
                </td>
                <td className="col-qty">{Number(item.quantity).toLocaleString()}</td>
                <td className="col-tax">{item.taxationType || '—'}</td>
                <td className="col-unit">{Number(item.price).toLocaleString()}</td>
                <td className="col-total">
                  {hasDiscount && grossTotal !== netTotal && (
                    <div className="total-gross">{grossTotal.toLocaleString()}</div>
                  )}
                  <div>{netTotal.toLocaleString()}</div>
                </td>
              </tr>
            )
          })}
          {/* Empty rows so short invoices still fill out a full-page form, same as the reference layout */}
          {[...Array(Math.max(0, 8 - items.length))].map((_, i) => (
            <tr key={`empty-${i}`} className="empty-row">
              <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* BOTTOM SECTION */}
      <div className="bottom">

        {/* Left: SDC Info + QR Code side by side */}
        <div className="sdc-qr-wrap">
          <div className="sdc-block">
            <div className="sdc-title">SDC INFORMATION</div>
            <div className="sdc-field">Date : {formatDate(receiptSale.saleDate)} time: {formatTime(receiptSale.confirmationDate)}</div>
            <div className="sdc-field">SDC ID : {receiptExtra?.sdcId || receiptSale.ebmSaleData?.sdcId || '—'}</div>
            <div className="sdc-field">
              RECEIPT NUMBER : {receiptSale.invoiceNo}
              {receiptSale.ebmSaleData?.totRcptNo ? `/${receiptSale.ebmSaleData.totRcptNo}` : ''}
              {' '}({receiptSale.saleType}{receiptSale.receiptType})
            </div>
            <div className="sdc-field">Internal Data : {receiptExtra?.internalData || receiptSale.ebmSaleData?.intrlData || '—'}</div>
            <div className="sdc-field">Receipt Signature : {receiptExtra?.signature || receiptSale.ebmSaleData?.rcptSign || '—'}</div>
            <br/>
            <div className="sdc-field">RECEIPT NUMBER : {receiptSale.invoiceNo}</div>
            <div className="sdc-field">Date: {formatDate(receiptSale.saleDate)} time: {formatTime(receiptSale.confirmationDate)}</div>
            <div className="sdc-field">MRC-{receiptExtra?.mrcNo || receiptSale.mrcNo || '—'}</div>
            <br/>
            <div className="cis-version">CIS VERSION Powered RRA VSCD EBM 2.1</div>
          </div>

          {/* QR Code beside SDC text */}
          <div className="qr-block">
            {qrUrl && <img src={qrUrl} alt="QR Code" />}
          </div>
        </div>

        {/* Right: Two separate bordered boxes */}
        <div className="right-boxes">

          {/* Totals box */}
          <div className="totals-box">
            <div className="total-row">
              <div className="total-label">Total Rwf</div>
              <div className="total-value">{Number(receiptSale.totalAmount).toLocaleString()}</div>
            </div>
            {Number(receiptSale.taxableAmountA) > 0 && (
              <div className="total-row">
                <div className="total-label">Total A-Ex</div>
                <div className="total-value">{Number(receiptSale.taxableAmountA).toLocaleString()}</div>
              </div>
            )}
            {Number(receiptSale.taxableAmountB) > 0 && (
              <>
                <div className="total-row">
                  <div className="total-label">Total B-18.00%</div>
                  <div className="total-value">{Number(receiptSale.taxableAmountB).toLocaleString()}</div>
                </div>
                <div className="total-row">
                  <div className="total-label">Tax B</div>
                  <div className="total-value">{Number(receiptSale.taxAmountB).toLocaleString()}</div>
                </div>
              </>
            )}
            {Number(receiptSale.taxableAmountC) > 0 && (
              <div className="total-row">
                <div className="total-label">Total C</div>
                <div className="total-value">{Number(receiptSale.taxableAmountC).toLocaleString()}</div>
              </div>
            )}
            {Number(receiptSale.taxableAmountD) > 0 && (
              <div className="total-row">
                <div className="total-label">Total D</div>
                <div className="total-value">{Number(receiptSale.taxableAmountD).toLocaleString()}</div>
              </div>
            )}
            <div className="total-row">
              <div className="total-label">TOTAL TAX:</div>
              <div className="total-value">{Number(receiptSale.totalTaxAmount).toLocaleString()}</div>
            </div>
          </div>

          {/* Payment box (separate) */}
          <div className="payment-box">
            <div className="payment-row">
              <div className="payment-label">PAYMENT METHOD:</div>
              <div className="payment-value">{PAYMENT_METHODS.find(p => p.v === receiptSale.paymentMethod)?.l || 'Cash'}</div>
            </div>
            <div className="payment-row">
              <div className="payment-label">ITEMS NUMBER:</div>
              <div className="payment-value">{items.length}</div>
            </div>
          </div>

        </div>

      </div>

    </div>
    </>
  )
}
