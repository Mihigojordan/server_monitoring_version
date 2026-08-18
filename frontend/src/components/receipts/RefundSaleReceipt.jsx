import { useMemo } from 'react'

// Layout follows CIS spec §14.1 (page 7) — example receipt type NORMAL, transaction type REFUND (NR).
export default function RefundSaleReceipt({ receiptSale, receiptExtra, qrUrl, onPrint }) {
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

  const items = useMemo(() => receiptSale.items?.data || [], [receiptSale.items])
  const totalItems = items.length

  return (
    <>
      <style>{`
      * { margin: 0; padding: 0; box-sizing: border-box; }

      .receipt-wrapper {
        display: flex;
        justify-content: center;
      }

      .receipt {
        background: #ffffff;
        width: 288px;
        padding: 28px 24px 24px;
        position: relative;
        font-family: 'Courier Prime', 'Courier New', monospace;
        clip-path: polygon(
          0% 8px, 6px 0%, 12px 8px, 18px 0%, 24px 8px,
          30px 0%, 36px 8px, 42px 0%, 48px 8px, 54px 0%,
          60px 8px, 66px 0%, 72px 8px, 78px 0%, 84px 8px,
          90px 0%, 96px 8px, 102px 0%, 108px 8px, 114px 0%,
          120px 8px, 126px 0%, 132px 8px, 138px 0%, 144px 8px,
          150px 0%, 156px 8px, 162px 0%, 168px 8px, 174px 0%,
          180px 8px, 186px 0%, 192px 8px, 198px 0%, 204px 8px,
          210px 0%, 216px 8px, 222px 0%, 228px 8px, 234px 0%,
          240px 8px, 246px 0%, 252px 8px, 258px 0%, 264px 8px,
          270px 0%, 276px 8px, 282px 0%, 288px 8px,
          100% 100%, 0% 100%
        );
      }

      .receipt::before {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 23px,
          rgba(0,0,0,0.03) 23px,
          rgba(0,0,0,0.03) 24px
        );
        pointer-events: none;
      }

      .center { text-align: center; }
      .store-name {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin-bottom: 2px;
      }
      .store-sub {
        font-size: 12px;
        color: #444;
        line-height: 1.6;
      }
      .divider {
        border: none;
        border-top: 1px dashed #aaa;
        margin: 10px 0;
      }
      .items { margin: 4px 0; }
      .item { margin-bottom: 8px; }
      .item-name {
        font-size: 12.5px;
        font-weight: 700;
      }
      .item-line {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #333;
      }
      .item-line .qty { color: #555; }
      .item-line .price { font-weight: 700; }
      .discount-line {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #555;
        padding-left: 8px;
      }
      .totals { margin: 4px 0; }
      .total-row {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        line-height: 1.8;
        color: #333;
      }
      .total-row.grand {
        font-size: 15px;
        font-weight: 700;
        color: #111;
        margin-bottom: 2px;
      }
      .total-row .amount { font-variant-numeric: tabular-nums; }
      .payment-section { margin: 4px 0; }
      .sdc-title {
        font-size: 12px;
        font-weight: 700;
        text-align: center;
        letter-spacing: 0.08em;
        margin-bottom: 6px;
      }
      .sdc-row {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        line-height: 1.9;
        color: #333;
      }
      .sdc-label { font-weight: 700; }
      .internal-data {
        font-size: 11px;
        text-align: center;
        margin: 4px 0 2px;
        color: #333;
        word-break: break-all;
      }
      .sig-label {
        font-size: 11px;
        font-weight: 700;
        text-align: center;
        margin-top: 4px;
      }
      .sig-value {
        font-size: 11px;
        text-align: center;
        color: #333;
        margin-bottom: 8px;
        word-break: break-all;
      }
      .qr-block {
        display: flex;
        justify-content: center;
        margin: 8px 0;
      }
      .qr-code {
        width: 72px;
        height: 72px;
      }
      .bottom-receipt { margin-top: 4px; }
      .bottom-row {
        display: flex;
        justify-content: space-between;
        font-size: 11.5px;
        line-height: 1.8;
      }
      .bottom-row .label { font-weight: 700; }
      .thank-you {
        text-align: center;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        line-height: 1.9;
        margin-top: 10px;
        color: #222;
      }
      .refund-title {
        text-align: center;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: #111;
      }
      .ref-line {
        text-align: center;
        font-size: 11px;
        font-weight: 700;
        color: #111;
        margin-top: 2px;
      }
      .refund-warning {
        text-align: center;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.6;
        color: #111;
      }
    `}</style>

    <div className="receipt-wrapper">
      <div className="receipt">

        {/* Store Header with Logos */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <img src="/image.png" alt="Company Logo" style={{ width: 50, height: 50, objectFit: 'contain' }}/>
          <div className="center" style={{ flex: 1 }}>
            <div className="store-name">{receiptSale.registrantName}</div>
            <div style={{ fontSize: '10px', color: '#333', marginTop: 1 }}>{receiptSale.receipt?.address || 'Kigali, Rwanda'}</div>
          </div>
          <img src="/rra_logo_2.png" alt="RRA Logo" style={{ width: 50, height: 50, objectFit: 'contain' }}/>
        </div>

        <div className="store-sub center" style={{ marginBottom: 8 }}>
          TIN: {receiptSale.tin}
        </div>

        <hr className="divider"/>

        {/* CIS spec §14.1 — REFUND title + reference to the SDC receipt number being refunded */}
        <div className="refund-title">REFUND</div>
        <div className="ref-line">REF. NORMAL RECEIPT#: {receiptSale.originalInvoiceNo ?? '—'}</div>

        <hr className="divider"/>

        <div className="refund-warning">
          REFUND IS APPROVED ONLY FOR<br/>
          ORIGINAL SALES RECEIPT
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>
          {receiptSale.customerName && <div>CLIENTNAME: {receiptSale.customerName}</div>}
          {receiptSale.customerTin
            ? <div>CLIENTTIN: {receiptSale.customerTin}</div>
            : <div>CLIENTPHONE: {receiptSale.customerMobileNo || '—'}</div>}
        </div>

        <hr className="divider"/>

        {/* Items — negative amounts per §14 (refund contains only negative, refunded amounts) */}
        <div className="items">
          {items.map((item, i) => (
            <div key={i} className="item">
              <div className="item-name">{item.name}</div>
              <div className="item-line">
                <span className="qty">
                  {Number(item.quantity).toLocaleString()}x&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                  {Number(item.price).toLocaleString()}
                </span>
                <span className="price">
                  {Number(item.totalAmount || item.quantity * item.price).toLocaleString()}
                  {item.taxationType || '—'}
                </span>
              </div>
              {item.discountAmount && Number(item.discountAmount) > 0 && (
                <div className="discount-line">
                  <span>discount -{((Number(item.discountAmount) / (Number(item.quantity) * Number(item.price))) * 100).toFixed(0)}%</span>
                  <span>{Number(item.discountAmount).toLocaleString()}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <hr className="divider"/>

        {/* Totals — all 4 categories always print (§7.22), with the live rate in the label */}
        <div className="totals">
          <div className="total-row grand">
            <span className="label">TOTAL</span>
            <span className="amount">{Number(receiptSale.totalAmount).toLocaleString()}</span>
          </div>
          <div className="total-row">
            <span className="label">TOTAL A-EX</span>
            <span className="amount">{Number(receiptSale.taxableAmountA || 0).toLocaleString()}</span>
          </div>
          <div className="total-row">
            <span className="label">TOTAL B-{Number(receiptSale.taxRateB || 0).toFixed(2)}%</span>
            <span className="amount">{Number(receiptSale.taxableAmountB || 0).toLocaleString()}</span>
          </div>
          <div className="total-row">
            <span className="label">TOTAL TAX B</span>
            <span className="amount">{Number(receiptSale.taxAmountB || 0).toLocaleString()}</span>
          </div>
          <div className="total-row">
            <span className="label">TOTAL C-{Number(receiptSale.taxRateC || 0).toFixed(2)}%</span>
            <span className="amount">{Number(receiptSale.taxableAmountC || 0).toLocaleString()}</span>
          </div>
          <div className="total-row">
            <span className="label">TOTAL D-{Number(receiptSale.taxRateD || 0).toFixed(2)}%</span>
            <span className="amount">{Number(receiptSale.taxableAmountD || 0).toLocaleString()}</span>
          </div>
          <div className="total-row">
            <span className="label">TOTAL TAX</span>
            <span className="amount">{Number(receiptSale.totalTaxAmount).toLocaleString()}</span>
          </div>
        </div>

        <hr className="divider"/>

        {/* Payment */}
        <div className="payment-section">
          <div className="total-row">
            <span className="label">CASH</span>
            <span className="amount">{Number(receiptSale.totalAmount).toLocaleString()}</span>
          </div>
          <div className="total-row">
            <span className="label">ITEMS NUMBER</span>
            <span className="amount">{totalItems}</span>
          </div>
        </div>

        <hr className="divider"/>

        {/* SDC Information */}
        <div className="sdc-title">SDC INFORMATION</div>

        <div className="sdc-row">
          <span className="sdc-label">Date: {formatDate(receiptSale.saleDate)}</span>
          <span>Time: {formatTime(receiptSale.confirmationDate)}</span>
        </div>
        <div className="sdc-row">
          <span className="sdc-label">SDC ID:</span>
          <span>{receiptExtra?.sdcId || receiptSale.ebmSaleData?.sdcId || '—'}</span>
        </div>
        <div className="sdc-row">
          <span className="sdc-label">RECEIPT NUMBER:</span>
          <span>
            {receiptSale.invoiceNo}
            {receiptSale.ebmSaleData?.totRcptNo ? `/${receiptSale.ebmSaleData.totRcptNo}` : ''}
            &nbsp;&nbsp;{receiptSale.saleType}{receiptSale.receiptType}
          </span>
        </div>

        <div className="internal-data">
          Internal Data:<br/>
          {receiptExtra?.internalData || receiptSale.ebmSaleData?.intrlData || '—'}
        </div>

        <div className="sig-label">Receipt Signature:</div>
        <div className="sig-value">
          {receiptExtra?.signature || receiptSale.ebmSaleData?.rcptSign || 'WAITING_FOR_SIGNATURE'}
        </div>

        {/* QR Code */}
        <div className="qr-block">
          {qrUrl && <img src={qrUrl} alt="Verification QR" className="qr-code"/>}
        </div>

        <hr className="divider"/>

        {/* Bottom receipt section */}
        <div className="bottom-receipt">
          <div className="bottom-row">
            <span className="label">RECEIPT NUMBER:</span>
            <span>{receiptSale.invoiceNo}</span>
          </div>
          <div className="bottom-row">
            <span className="label">DATE: {formatDate(receiptSale.saleDate)}</span>
            <span>TIME: {formatTime(receiptSale.confirmationDate)}</span>
          </div>
          <div className="bottom-row">
            <span className="label">MRC:</span>
            <span>{receiptExtra?.mrcNo || '—'}</span>
          </div>
        </div>

        <hr className="divider"/>

        {/* Thank you — §14.1 example ends with just THANK YOU, no extra tagline */}
        <div className="thank-you">
          THANK YOU
        </div>

      </div>
    </div>
    </>
  )
}
