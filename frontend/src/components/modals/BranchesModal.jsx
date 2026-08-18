import { useState, useEffect } from 'react'
import { operatorApi } from '../../api/operator'

export default function BranchesModal({ isOpen, onClose, branchId = '00' }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastRequestDt, setLastRequestDt] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchBranches()
    }
  }, [isOpen])

  const fetchBranches = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await operatorApi.selectBranches(branchId, lastRequestDt)

      if (response.resultCd === '000' || response.resultCd === '001') {
        if (response.data?.bhfList) {
          setData(response.data.bhfList)
          setLastRequestDt(response.resultDt)
        } else {
          setData([])
        }
      } else {
        setError(response.resultMsg || 'Failed to fetch branches')
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const getStatusBadge = (status) => {
    const colors = {
      'A': { bg: '#dcfce7', color: '#166534', label: 'Active' },
      'D': { bg: '#fee2e2', color: '#991b1b', label: 'Discard' }
    }
    const style = colors[status] || { bg: '#f3f4f6', color: '#6b7280', label: status }
    return {
      ...style,
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500'
    }
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
        maxWidth: '1000px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
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
            Branch Information (EBM Sync)
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
              <div style={{ fontSize: '12px' }}>Fetching branch information from EBM</div>
            </div>
          ) : data.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#6b7280'
            }}>
              No branches found
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {data.map((branch, idx) => {
                const statusStyle = getStatusBadge(branch.bhfSttsCd)
                return (
                  <div key={idx} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '16px',
                    background: '#f9fafb',
                    transition: 'all 0.2s'
                  }}>
                    {/* Branch Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start',
                      marginBottom: '12px'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1f2937',
                          marginBottom: '4px'
                        }}>
                          {branch.bhfNm}
                          {branch.hqYn === 'Y' && (
                            <span style={{
                              marginLeft: '8px',
                              display: 'inline-block',
                              background: '#dbeafe',
                              color: '#1e40af',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}>
                              HQ
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>
                          TIN: <span style={{ fontFamily: 'monospace' }}>{branch.tin}</span> | ID: <span style={{ fontFamily: 'monospace' }}>{branch.bhfId}</span>
                        </div>
                      </div>
                      <div style={statusStyle}>
                        {statusStyle.label}
                      </div>
                    </div>

                    {/* Branch Details Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '12px',
                      borderTop: '1px solid #e5e7eb',
                      paddingTop: '12px'
                    }}>
                      {/* Location Info */}
                      <div>
                        <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Location</div>
                        <div style={{ fontSize: '13px', color: '#374151' }}>
                          <div>{branch.locDesc || '—'}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                            {[branch.dstrtNm, branch.prvncNm].filter(Boolean).join(', ') || 'N/A'}
                          </div>
                          {branch.sctrNm && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              Sector: {branch.sctrNm}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Manager Info */}
                      <div>
                        <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Manager</div>
                        <div style={{ fontSize: '13px', color: '#374151' }}>
                          <div>{branch.mgrNm || '—'}</div>
                          {branch.mgrTelNo && (
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                              ☎️ {branch.mgrTelNo}
                            </div>
                          )}
                          {branch.mgrEmail && (
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                              ✉️ {branch.mgrEmail}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
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
            onClick={fetchBranches}
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
