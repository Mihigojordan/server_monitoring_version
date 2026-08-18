import { useState, useEffect } from 'react'
import { operatorApi } from '../../../api/operator'

export default function ItemClassificationModal({ isOpen, onClose, branchId }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastRequestDt, setLastRequestDt] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchItemClassifications()
    }
  }, [isOpen])

  const fetchItemClassifications = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await operatorApi.selectItemsClass(branchId || '00', lastRequestDt)

      if (response.resultCd === '000' || response.resultCd === '001') {
        if (response.data?.itemClsList) {
          setData(response.data.itemClsList)
          setLastRequestDt(response.resultDt)
        } else {
          setData([])
        }
      } else {
        setError(response.resultMsg || 'Failed to fetch item classifications')
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const getTaxBadgeStyle = (taxType) => {
    const baseStyle = {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      minWidth: '50px',
      textAlign: 'center'
    }

    const colorMap = {
      'A': { background: '#fef3c7', color: '#b45309' },
      'B': { background: '#dbeafe', color: '#1e40af' },
      'C': { background: '#dcfce7', color: '#166534' },
      'D': { background: '#fecaca', color: '#991b1b' }
    }

    return { ...baseStyle, ...(colorMap[taxType] || { background: '#f3f4f6', color: '#6b7280' }) }
  }

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
        maxWidth: '900px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
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
            Item Classifications (EBM Sync)
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
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1
        }}>
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

          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#6b7280'
            }}>
              <div style={{ marginBottom: '12px' }}>Loading...</div>
              <div style={{ fontSize: '12px' }}>Fetching item classifications from EBM</div>
            </div>
          ) : data.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#6b7280'
            }}>
              No item classifications found
            </div>
          ) : (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Code</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Level</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Tax Type</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Major Target</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Used</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => (
                  <tr key={idx} style={{
                    borderBottom: '1px solid #e5e7eb',
                    ':hover': { background: '#f9fafb' }
                  }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px', color: '#1f2937' }}>
                      {item.itemClsCd}
                    </td>
                    <td style={{ padding: '12px', color: '#1f2937' }}>
                      {item.itemClsNm}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>
                      {item.itemClsLvl}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={getTaxBadgeStyle(item.taxTyCd)}>
                        {item.taxTyCd || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#1f2937' }}>
                      {item.mjrTgYn === 'Y' ? '✓' : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#1f2937' }}>
                      {item.useYn === 'Y' ? '✓' : '✗'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={fetchItemClassifications}
            disabled={loading}
            style={{
              padding: '8px 16px',
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
            {loading ? 'Syncing...' : 'Refresh from EBM'}
          </button>
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
