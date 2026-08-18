import { useState, useEffect } from 'react'
import { operatorApi } from '../../api/operator'

export default function NoticesModal({ isOpen, onClose, branchId = '00' }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastRequestDt, setLastRequestDt] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchNotices()
    }
  }, [isOpen])

  const fetchNotices = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await operatorApi.selectNotices(branchId, lastRequestDt)

      if (response.resultCd === '000' || response.resultCd === '001') {
        if (response.data?.noticeList) {
          setData(response.data.noticeList)
          setLastRequestDt(response.resultDt)
        } else {
          setData([])
        }
      } else {
        setError(response.resultMsg || 'Failed to fetch notices')
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 14) return dateStr
    try {
      const year = dateStr.substring(0, 4)
      const month = dateStr.substring(4, 6)
      const day = dateStr.substring(6, 8)
      const hour = dateStr.substring(8, 10)
      const minute = dateStr.substring(10, 12)
      return `${day}/${month}/${year} ${hour}:${minute}`
    } catch {
      return dateStr
    }
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
        maxWidth: '900px',
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
          alignItems: 'center',
          background: '#f9fafb'
        }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>
              📢 RRA Notices
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
              Official notices from Rwanda Revenue Authority
            </p>
          </div>
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
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#6b7280'
            }}>
              <div style={{ marginBottom: '12px' }}>Loading notices...</div>
              <div style={{ fontSize: '12px' }}>Syncing latest notices from RRA</div>
            </div>
          ) : data.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
              <div style={{ fontWeight: '500' }}>All caught up!</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>No new notices from RRA</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {data.map((notice, idx) => (
                <div key={idx} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: notice.dtlUrl ? '#f0f9ff' : '#f9fafb',
                  transition: 'all 0.2s'
                }}>
                  {/* Notice Header */}
                  <div
                    onClick={() => setExpandedId(expandedId === idx ? null : idx)}
                    style={{
                      padding: '14px 16px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      borderBottom: expandedId === idx ? '1px solid #e5e7eb' : 'none'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1f2937',
                          marginBottom: '4px',
                          wordBreak: 'break-word'
                        }}>
                          {notice.title}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          display: 'flex',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}>
                          <span>📅 {formatDate(notice.regDt)}</span>
                          {notice.regrNm && <span>👤 {notice.regrNm}</span>}
                          {notice.noticeNo && <span>#{notice.noticeNo}</span>}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '18px',
                        color: '#9ca3af',
                        marginLeft: '12px',
                        transition: 'transform 0.2s',
                        transform: expandedId === idx ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}>
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Notice Content */}
                  {expandedId === idx && (
                    <div style={{
                      padding: '14px 16px',
                      borderTop: '1px solid #e5e7eb',
                      background: 'white'
                    }}>
                      <div style={{
                        fontSize: '13px',
                        lineHeight: '1.6',
                        color: '#374151',
                        marginBottom: '12px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        paddingRight: '8px'
                      }}>
                        {notice.cont || 'No content available'}
                      </div>
                      {notice.dtlUrl && (
                        <a
                          href={notice.dtlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-block',
                            color: '#3b82f6',
                            fontSize: '13px',
                            textDecoration: 'none',
                            padding: '6px 12px',
                            background: '#dbeafe',
                            borderRadius: '4px',
                            fontWeight: '500',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#bfdbfe'
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#dbeafe'
                          }}
                        >
                          🔗 View Full Notice
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          justifyContent: 'space-between',
          background: '#f9fafb'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#6b7280'
          }}>
            {data.length > 0 && `Showing ${data.length} notice${data.length !== 1 ? 's' : ''}`}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={fetchNotices}
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
              {loading ? 'Syncing...' : '🔄 Refresh'}
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
    </div>
  )
}
