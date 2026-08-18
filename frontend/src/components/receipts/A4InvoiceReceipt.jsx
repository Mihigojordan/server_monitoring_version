import { useMemo } from 'react'

const PAYMENT_METHODS = [
  { v: '01', l: 'Cash' }, { v: '02', l: 'Credit' }, { v: '03', l: 'Cash/Credit' },
  { v: '04', l: 'Bank Cheque' }, { v: '05', l: 'Debit/Credit Card' },
  { v: '06', l: 'Mobile Money' }, { v: '07', l: 'Other' },
]

export default function A4InvoiceReceipt({ receiptSale, receiptExtra, qrUrl }) {
  const items = useMemo(() => receiptSale.items?.data || [], [receiptSale.items])

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

  return (
    <div style={{
      width: '100%',
      maxWidth: '900px',
      background: '#fff',
      padding: '40px',
      fontFamily: 'Arial, sans-serif',
      color: '#000',
      fontSize: '13px',
      lineHeight: '1.5'
    }}>
      {/* Header with Logos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, paddingBottom: 20, borderBottom: '2px solid #333' }}>
        <img src="/image.png" alt="Company Logo" style={{ width: 60, height: 60, objectFit: 'contain' }} />
        <div style={{ textAlign: 'center', flex: 1, marginX: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{receiptSale.registrantName}</div>
          <div style={{ fontSize: 11, marginBottom: 8 }}>
            {receiptSale.receipt?.address || 'Kigali, Rwanda'}<br/>
            TEL: {receiptSale.tin} | EMAIL: {receiptSale.tin}
          </div>
        </div>
        <img src="/rra_logo_2.png" alt="RRA Logo" style={{ width: 60, height: 60, objectFit: 'contain' }} />
      </div>

      {/* Invoice To & Invoice Number - Parallel Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 30 }}>
        {/* Invoice To */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: 10, borderBottom: '1px solid #000', paddingBottom: 5 }}>INVOICE TO</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {receiptSale.customerTin && (
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700 }}>TIN</td>
                  <td style={{ border: '1px solid #000', padding: '8px' }}>{receiptSale.customerTin}</td>
                </tr>
              )}
              {receiptSale.customerName && (
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700 }}>Name</td>
                  <td style={{ border: '1px solid #000', padding: '8px' }}>{receiptSale.customerName}</td>
                </tr>
              )}
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700 }}>Phone</td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>{receiptSale.customerPhone || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Invoice Number & Date */}
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700, width: '40%' }}>INVOICE NO:</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontSize: 12, fontWeight: 700 }}>{receiptSale.invoiceNo}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700 }}>Date:</td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>{formatDate(receiptSale.saleDate)} {formatTime(receiptSale.confirmationDate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30 }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'left', fontWeight: 700 }}>No.</th>
            <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'left', fontWeight: 700 }}>Item code</th>
            <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'left', fontWeight: 700 }}>Item Description</th>
            <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', fontWeight: 700 }}>Qty</th>
            <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', fontWeight: 700 }}>Tax</th>
            <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', fontWeight: 700 }}>Unit Price</th>
            <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', fontWeight: 700 }}>Total Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>{i + 1}</td>
              <td style={{ border: '1px solid #000', padding: '10px' }}>{item.code || '—'}</td>
              <td style={{ border: '1px solid #000', padding: '10px' }}>{item.name}</td>
              <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>{Number(item.quantity).toLocaleString()}</td>
              <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>{item.taxationType || '—'}</td>
              <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{Number(item.price).toLocaleString()}</td>
              <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', fontWeight: 700 }}>{Number(item.totalAmount || item.quantity * item.price).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bottom Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginBottom: 30 }}>
        {/* SDC Information */}
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15 }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700, width: '40%' }}>Date:</td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>{formatDate(receiptSale.saleDate)} Time: {formatTime(receiptSale.confirmationDate)}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700 }}>SDC ID:</td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>{receiptExtra?.sdcId || receiptSale.ebmSaleData?.sdcId || '—'}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700 }}>RECEIPT NUMBER:</td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>{receiptSale.invoiceNo}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Internal Data:</div>
            <div style={{ wordBreak: 'break-all', border: '1px solid #ccc', padding: 6, background: '#f9f9f9' }}>
              {receiptExtra?.internalData || receiptSale.ebmSaleData?.intrlData || '—'}
            </div>
          </div>

          <div style={{ fontSize: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Receipt Signature:</div>
            <div style={{ wordBreak: 'break-all', border: '1px solid #ccc', padding: 6, background: '#f9f9f9' }}>
              {receiptExtra?.signature || receiptSale.ebmSaleData?.rcptSign || 'WAITING_FOR_SIGNATURE'}
            </div>
          </div>

          {qrUrl && (
            <div style={{ marginTop: 15, textAlign: 'center' }}>
              <img src={qrUrl} alt="QR Code" style={{ width: 100, height: 100, border: '1px solid #000' }} />
            </div>
          )}
        </div>

        {/* Totals & Payment */}
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15 }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700 }}>Total Rief</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{Number(receiptSale.totalAmount - receiptSale.totalTaxAmount).toLocaleString()}</td>
              </tr>
              {Number(receiptSale.taxableAmountA) > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700 }}>Total A-Ex</td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{Number(receiptSale.taxableAmountA).toLocaleString()}</td>
                </tr>
              )}
              <tr style={{ background: '#e8e8e8' }}>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 700 }}>TOTAL TAX:</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 700 }}>{Number(receiptSale.totalTaxAmount).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontWeight: 700, marginBottom: 8 }}>PAYMENT METHOD:</div>
          <div style={{ marginBottom: 15 }}>{PAYMENT_METHODS.find(p => p.v === receiptSale.paymentMethod)?.l || 'Cash'}</div>

          <div style={{ fontWeight: 700, marginBottom: 8 }}>ITEMS NUMBER:</div>
          <div>{items.length}</div>
        </div>
      </div>

      {/* CIS Information */}
      <div style={{ borderTop: '2px solid #000', paddingTop: 15, marginTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0px' }}>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: 10 }}>RECEIPT NUMBER:</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{receiptSale.invoiceNo}</div>
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: 10 }}>Date:</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>{formatDate(receiptSale.saleDate)}</div>
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: 10 }}>TIME:</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>{formatTime(receiptSale.confirmationDate)}</div>
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: 10 }}>MRC:</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, minHeight: '20px', letterSpacing: 1 }}>
              {receiptExtra?.mrcNo || receiptSale.ebmSaleData?.mrcNo || receiptSale.mrcNo || '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
