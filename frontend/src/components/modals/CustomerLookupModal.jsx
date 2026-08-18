import { useState } from 'react'
import { operatorApi } from '../../api/operator'

export default function CustomerLookupModal({ isOpen, onClose, onSelectCustomer, branchId = '00' }) {
  const [customerTin, setCustomerTin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!customerTin.trim()) {
      setError('Please enter a customer TIN')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await operatorApi.selectCustomer(branchId, customerTin.trim())

      if (response.resultCd === '000' || response.resultCd === '001') {
        if (response.data?.custList && response.data.custList.length > 0) {
          setResult({
            found: true,
            customers: response.data.custList,
          })
        } else {
          setResult({
            found: false,
            message: 'No customers found with this TIN',
          })
        }
      } else {
        setError(response.resultMsg || 'Failed to search customers')
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCustomer = (customer) => {
    if (onSelectCustomer) {
      onSelectCustomer({
        tin: customer.tin,
        name: customer.taxprNm,
        status: customer.taxprSttsCd,
        province: customer.prvncNm,
        district: customer.dstrtNm,
        sector: customer.sctrNm,
        address: customer.locDesc,
      })
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '600px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            Lookup Customer
          </h2>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#6b7280'
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          <form onSubmit={handleSearch}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Customer TIN <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={customerTin}
                onChange={(e) => {
                  setCustomerTin(e.target.value)
                  setError('')
                }}
                placeholder="Enter 9-digit TIN (e.g., 123456789)"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: error ? '2px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => {
                  if (!error) e.target.style.borderColor = '#3b82f6'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? '#ef4444' : '#d1d5db'
                }}
              />
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                RRA TIN format: 9 digits
              </div>
            </div>

            {error && (
              <div style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            {result && !result.found && (
              <div style={{
                background: '#fef3c7',
                color: '#78350f',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {result.message}
              </div>
            )}

            {result && result.found && result.customers && result.customers.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  letterSpacing: '0.05em'
                }}>
                  Found {result.customers.length} customer(s)
                </div>
                {result.customers.map((customer, idx) => (
                  <div key={idx} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    ':hover': {
                      background: '#f3f4f6',
                      borderColor: '#3b82f6'
                    }
                  }} onClick={() => handleSelectCustomer(customer)}>
                    <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                      {customer.taxprNm}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                      TIN: <span style={{ fontFamily: 'monospace' }}>{customer.tin}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '2px' }}>
                      Status: <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: customer.taxprSttsCd === 'A' ? '#dcfce7' : '#fee2e2',
                        color: customer.taxprSttsCd === 'A' ? '#166534' : '#991b1b',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {customer.taxprSttsCd === 'A' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {customer.dstrtNm && customer.prvncNm
                        ? `${customer.dstrtNm}, ${customer.prvncNm}`
                        : customer.locDesc || 'No location'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                      Click to select this customer
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Searching...' : 'Search Customer'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'right'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
