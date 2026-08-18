import { useState, useEffect, useCallback } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'
import { useApp } from '../../context/AppContext'

// ── Constants ──────────────────────────────────────────────────────────────
const PER_PAGE = 15

const MOVEMENT_TYPES = [
  { v: '01', l: 'Incoming Import', dir: 'IN' },
  { v: '02', l: 'Incoming Purchase', dir: 'IN' },
  { v: '03', l: 'Incoming Return', dir: 'IN', needsRef: true },
  { v: '04', l: 'Incoming Stock Movement', dir: 'IN' },
  { v: '05', l: 'Incoming Processing', dir: 'IN' },
  { v: '06', l: 'Incoming Adjustment', dir: 'IN' },
  { v: '11', l: 'Outgoing Sale', dir: 'OUT' },
  { v: '12', l: 'Outgoing Return', dir: 'OUT', needsRef: true },
  { v: '13', l: 'Outgoing Stock Movement', dir: 'OUT' },
  { v: '14', l: 'Outgoing Processing', dir: 'OUT' },
  { v: '15', l: 'Outgoing Discarding', dir: 'OUT' },
  { v: '16', l: 'Outgoing Adjustment', dir: 'OUT' },
]

// RRA adjustment reason codes — mandatory when type is 06 (IN Adjustment) or 16 (OUT Adjustment)
const ADJUSTMENT_REASONS = [
  { v: '01', l: 'Expiry / Damaged goods' },
  { v: '02', l: 'Transfer between branches' },
  { v: '03', l: 'Manual correction / Counting error' },
  { v: '04', l: 'Return to supplier' },
  { v: '05', l: 'Other (describe in notes)' },
]
const ADJUSTMENT_TYPES = ['06', '16']

const EMPTY_MOVE  = { storedAndReleasedType: '02', originalStoredAndReleaseNo: '', itemCd: '', quantity: '', unitCost: '', remark: '' }
const EMPTY_COUNT = { itemCode: '', remainQuantity: '' }

// ── Icons ──────────────────────────────────────────────────────────────────
const IcoPlus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
const IcoHistory = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" /></svg>
const IcoBox = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
const IcoSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>
const IcoEdit = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
const IcoDelete = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
const IcoAlert = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
const IcoCheck = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
const IcoArrowUp = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
const IcoArrowDown = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
const IcoTarget = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
const IcoCount = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoEye = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>

export default function InventoryList() {
  const { rawUser } = useApp()
  const branchId = rawUser?.branchId || ''
  const isTrainingMode = rawUser?.isTrainingMode || false

  const [viewTab, setViewTab] = useState('Status') // 'Status' | 'Masters' | 'History' | 'Adjust' | 'Transfer' | 'Count'

  // Status State
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)

  // Filters
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | 'low' | 'inactive'

  // History State
  const [history, setHistory] = useState([])
  const [histPage, setHistPage] = useState(1)
  const [histTotal, setHistTotal] = useState(0)
  const [histLast, setHistLast] = useState(1)
  const [histLoading, setHistLoading] = useState(false)

  // Adjust Form State
  const [moveForm, setMoveForm] = useState(EMPTY_MOVE)
  const [moveSaving, setMoveSaving] = useState(false)
  const [moveErr, setMoveErr] = useState(null)
  const [moveOk, setMoveOk] = useState(false)
  const [itemList, setItemList] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Management Modal State
  const [manageItem, setManageItem] = useState(null)
  const [manageTab,  setManageTab]  = useState('Stock') // 'Stock' | 'Info' | 'History'
  const [editForm,   setEditForm]   = useState({})
  const [saving,     setSaving]     = useState(false)
  const [saveErr,    setSaveErr]    = useState(null)
  
  const [auditQty,    setAuditQty]    = useState('0')
  const [auditMode,   setAuditMode]   = useState('add') // 'add' | 'reset'
  const [auditSaving, setAuditSaving] = useState(false)

  const [viewingItem, setViewingItem] = useState(null)

  // Inventory Count Tab State
  const [countForm,        setCountForm]        = useState({ ...EMPTY_COUNT })
  const [countSaving,      setCountSaving]      = useState(false)
  const [countErr,         setCountErr]         = useState(null)
  const [countOk,          setCountOk]          = useState(false)
  const [syncing,          setSyncing]          = useState(false)
  const [syncMsg,          setSyncMsg]          = useState(null)
  const [countSearchQuery, setCountSearchQuery] = useState('')
  const [countItemList,    setCountItemList]    = useState([])
  const [countSearching,   setCountSearching]   = useState(false)

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadStatus = useCallback(async (p = 1) => {
    setLoading(true); setError(null)
    try {
      let res
      if (keyword.length >= 2) {
        res = await operatorApi.searchItems(keyword, p, PER_PAGE)
      } else {
        res = await operatorApi.listItems(p, PER_PAGE)
      }

      const data = res?.items?.data || res?.data
      if (Array.isArray(data)) {
        setItems(data)
        setTotal(res?.items?.meta?.total || res?.meta?.total || data.length)
        setLastPage(res?.items?.meta?.lastPage || res?.meta?.lastPage || 1)
        setPage(p)
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [keyword])

  const loadHistory = useCallback(async (p = 1) => {
    setHistLoading(true)
    try {
      const res = await operatorApi.listStocks(p, PER_PAGE)
      const data = res?.data || []
      setHistory(data)
      setHistTotal(res?.meta?.total || data.length)
      setHistLast(res?.meta?.lastPage || 1)
      setHistPage(p)
    } catch (err) { console.error(err) }
    finally { setHistLoading(false) }
  }, [])

  // Transfer State (F-20)
  const [transferForm,    setTransferForm]    = useState({ itemCode: '', itemName: '', quantity: '', toBranchId: '' })
  const [transferSaving,  setTransferSaving]  = useState(false)
  const [transferErr,     setTransferErr]     = useState(null)
  const [transferOk,      setTransferOk]      = useState(null)
  const [transferSearch,  setTransferSearch]  = useState('')
  const [transferItems,   setTransferItems]   = useState([])
  const [branches,        setBranches]        = useState([])

  useEffect(() => {
    // GET /branches/ returns { branches: { data, meta }, branchCount } —
    // not a bare array or { data }, so this was always resolving to [].
    operatorApi.listBranches().then(res => {
      const list = Array.isArray(res) ? res : res?.branches?.data ?? res?.data ?? []
      setBranches(list)
    }).catch(() => {})
  }, [])

  async function searchTransferItems(q) {
    setTransferSearch(q)
    if (!q || q.length < 2) { setTransferItems([]); return }
    try {
      const res = await operatorApi.searchItems(q, 1, 10)
      setTransferItems(res?.items?.data ?? res?.data ?? [])
    } catch { setTransferItems([]) }
  }

  async function handleTransfer(e) {
    e.preventDefault(); setTransferErr(null); setTransferSaving(true); setTransferOk(null)
    try {
      const res = await operatorApi.transferStock({
        itemCode: transferForm.itemCode,
        quantity: Number(transferForm.quantity),
        toBranchId: transferForm.toBranchId,
        remark: '02',
      })
      setTransferOk(res.message)
      setTransferForm({ itemCode: '', itemName: '', quantity: '', toBranchId: '' })
      setTransferSearch('')
      setTimeout(() => setTransferOk(null), 5000)
    } catch (err) {
      setTransferErr(err.data?.error || err.data?.resultMsg || err.message || 'Transfer failed')
    } finally { setTransferSaving(false) }
  }

  // Masters State
  const [masters,        setMasters]        = useState([])
  const [mastersPage,    setMastersPage]    = useState(1)
  const [mastersTotal,   setMastersTotal]   = useState(0)
  const [mastersLast,    setMastersLast]    = useState(1)
  const [mastersLoading, setMastersLoading] = useState(false)
  const [mastersSearch,  setMastersSearch]  = useState('')

  const loadMasters = useCallback(async (p = 1) => {
    setMastersLoading(true)
    try {
      const res = await operatorApi.listStockMasters(p, 50)
      const data = res?.data ?? []
      setMasters(data)
      setMastersTotal(res?.meta?.total ?? data.length)
      setMastersLast(res?.meta?.lastPage ?? 1)
      setMastersPage(p)
    } catch (err) { console.error(err) }
    finally { setMastersLoading(false) }
  }, [])

  useEffect(() => {
    if (viewTab === 'Status')  loadStatus(1)
    if (viewTab === 'History') loadHistory(1)
    if (viewTab === 'Masters') loadMasters(1)
  }, [viewTab, loadStatus, loadHistory, loadMasters])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const searchItemsInForm = useCallback(async (q) => {
    setSearchQuery(q)
    if (!q || q.length < 2) { setItemList([]); return }
    setSearching(true)
    try {
      const res = await operatorApi.searchItems(q, 1, 15)
      setItemList(res?.data || res?.items?.data || [])
    } catch { setItemList([]) }
    finally { setSearching(false) }
  }, [])

  async function handleMovement(e) {
    e.preventDefault(); setMoveErr(null); setMoveSaving(true); setMoveOk(false)
    try {
      const selectedType = MOVEMENT_TYPES.find(t => t.v === moveForm.storedAndReleasedType)
      const isAdjustment = ADJUSTMENT_TYPES.includes(moveForm.storedAndReleasedType)
      if (isAdjustment && !moveForm.remark.trim()) {
        setMoveErr('Reason is required for adjustment movements (RRA §9.2).')
        setMoveSaving(false)
        return
      }
      const payload = {
        storedAndReleasedType: moveForm.storedAndReleasedType,
        itemCd: moveForm.itemCd,
        quantity: Number(moveForm.quantity),
        unitCost: Number(moveForm.unitCost),
        branchId,
        remark: moveForm.remark || undefined,
      }
      if (moveForm.originalStoredAndReleaseNo) payload.originalStoredAndReleaseNo = Number(moveForm.originalStoredAndReleaseNo)
      await operatorApi.saveStock(payload)
      logActivity({ action: 'STOCK_MOVEMENT', category: 'Inventory', summary: `Stock ${selectedType?.dir} recorded for item ${moveForm.itemCd}` })
      setMoveOk(true); setMoveForm(EMPTY_MOVE); setSearchQuery('')
      setTimeout(() => { setMoveOk(false); setViewTab('Status') }, 3000)
    } catch (err) {
      setMoveErr(err.data?.resultMsg || err.data?.errors?.[0]?.message || err.message || 'Operation failed')
    } finally { setMoveSaving(false) }
  }

  async function handleUpdate(e) {
    e.preventDefault(); setSaveErr(null); setSaving(true)
    try {
      await operatorApi.updateItem([editForm])
      logActivity({ action: 'UPDATE_ITEM', category: 'Inventory', summary: `Updated item "${editForm.name}"` })
      setManageItem(null); loadStatus(page)
    } catch (err) {
      setSaveErr(err.data?.errors?.[0]?.message || err.message)
    } finally { setSaving(false) }
  }

  async function handleAudit(e) {
    e.preventDefault(); setAuditSaving(true)
    try {
      const val = Number(auditQty)
      if (auditMode === 'reset') {
        await operatorApi.saveMaster({
          itemCode: manageItem.code,
          remainQuantity: val,
          branchId,
        })
        logActivity({ action: 'STOCK_RECONCILE', category: 'Inventory', summary: `Audited ${manageItem.name}: Reset stock to ${val}` })
      } else {
        const isAdd = val >= 0
        await operatorApi.saveStock({
          storedAndReleasedType: isAdd ? '06' : '16',
          itemCd: manageItem.code,
          quantity: Math.abs(val),
          unitCost: Number(manageItem.defaultUnitPrice || 0),
          branchId,
        })
        logActivity({ action: 'STOCK_ADJUST', category: 'Inventory', summary: `${isAdd ? 'Added' : 'Subtracted'} ${Math.abs(val)} for ${manageItem.name}` })
      }
      setManageItem(null); setAuditQty('0'); loadStatus(page)
    } catch (err) {
      alert(err.data?.errors?.[0]?.message || err.data?.resultMsg || err.message)
    } finally { setAuditSaving(false) }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Are you sure you want to deactivate "${item.name}"?`)) return
    try {
      await operatorApi.deleteItem(item.code)
      logActivity({ action: 'DELETE_ITEM', category: 'Inventory', summary: `Deactivated item "${item.name}"` })
      loadStatus(page)
    } catch (err) { alert(err.message) }
  }

  function openManage(item, tab = 'Info') {
    setManageItem(item)
    setManageTab(tab)
    setAuditQty(item.remainQuantity || 0)
    setAuditMode('reset')
    setEditForm({
      id: item.id,
      name: item.name,
      taxTypeCode: item.taxTypeCode,
      defaultUnitPrice: item.defaultUnitPrice,
      typeCode: item.typeCode,
      useYn: item.useYn,
      cisProductId: item.cisProductId 
    })
  }

  const filteredItems = items.filter(item => {
    if (filterType === 'low') return (item.remainQuantity || 0) <= 5
    if (filterType === 'inactive') return item.useYn === 'N'
    return true
  })

  // ── Inventory Count Handlers ──────────────────────────────────────────────
  const searchCountItems = useCallback(async (q) => {
    setCountSearchQuery(q)
    if (!q || q.length < 2) { setCountItemList([]); return }
    setCountSearching(true)
    try {
      const res = await operatorApi.searchItems(q, 1, 15)
      setCountItemList(res?.data || res?.items?.data || [])
    } catch { setCountItemList([]) }
    finally { setCountSearching(false) }
  }, [])

  async function handleMaster(e) {
    e.preventDefault(); setCountErr(null); setCountSaving(true); setCountOk(false)
    try {
      await operatorApi.saveMaster({
        itemCode: countForm.itemCode,
        remainQuantity: Number(countForm.remainQuantity),
        branchId,
      })
      logActivity({ action: 'STOCK_MASTER', category: 'Inventory', summary: `Inventory Count: Set ${countForm.itemCode} to ${countForm.remainQuantity}` })
      setCountOk(true); setCountForm({ ...EMPTY_COUNT }); setCountSearchQuery('')
      setTimeout(() => setCountOk(false), 5000)
    } catch (err) {
      setCountErr(err.data?.resultMsg || err.data?.errors?.[0]?.message || err.message || 'Operation failed')
    } finally { setCountSaving(false) }
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      await operatorApi.syncStock()
      setSyncMsg('Stock levels synchronized with RRA successfully.')
    } catch (err) { setSyncMsg(`Sync failed: ${err.message}`) }
    finally { setSyncing(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="page" style={{ background: 'var(--bg)', minHeight: '100%' }}>

        {/* ── Page Header ── */}
        <div className="page-head" style={{ marginBottom: 28 }}>
          <div>
            <div className="crumbs"><span>Workspace</span><span>›</span><span>Stock Management</span></div>
            <h1 style={{ fontSize: 28, fontWeight: 800 }}>Inventory Status</h1>
          </div>
          <div className="page-head__actions">
            <div className="field" style={{ background: '#fff', border: '1px solid var(--ink-200)', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, height: 42, width: 260 }}>
              <IcoSearch />
              <input style={{ border: 0, outline: 0, fontSize: 13, width: '100%' }}
                placeholder="Filter by keyword..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)} />
            </div>
            <button className="btn btn--lg btn--primary" onClick={() => setViewTab('Adjust')} style={{ height: 42, padding: '0 18px', borderRadius: 10, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>
              <IcoPlus /> Record Movement
            </button>
          </div>
        </div>

        {/* ── Segmented Control (Modern Tabs) ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ background: 'var(--ink-100)', padding: 4, borderRadius: 12, display: 'inline-flex', gap: 2, border: '1px solid var(--ink-200)' }}>
            {[
              { id: 'Status',   label: 'Current Inventory', icon: <IcoBox /> },
              { id: 'Masters',  label: 'Stock Balances',    icon: <IcoTarget /> },
              { id: 'History',  label: 'Movement History',  icon: <IcoHistory /> },
              { id: 'Transfer', label: 'Branch Transfer',   icon: <IcoArrowUp /> },
              { id: 'Count',    label: 'Inventory Count',   icon: <IcoCount /> },
            ].map(t => (
              <button key={t.id}
                className={`btn btn--ghost`}
                onClick={() => setViewTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 20px',
                  fontSize: 13.5, fontWeight: 600, borderRadius: 9,
                  background: viewTab === t.id ? '#fff' : 'transparent',
                  color: viewTab === t.id ? 'var(--brand-700)' : 'var(--ink-500)',
                  boxShadow: viewTab === t.id ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all .2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Strip ── */}
        {viewTab === 'Status' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className={`stat-card ${filterType === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilterType('all')}
              style={{ padding: '16px 20px', border: filterType === 'all' ? '2px solid var(--brand-500)' : '1px solid var(--ink-200)', background: '#fff', cursor: 'pointer' }}>
              <div className="stat-card__left">
                <div className="stat-card__label">Total Products</div>
                <div className="stat-card__value" style={{ fontSize: 32 }}>{total}</div>
                <div className="stat-card__sub">view all items</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--brand-50)', color: 'var(--brand-600)', display: 'grid', placeItems: 'center' }}>
                <IcoBox />
              </div>
            </div>
            <div className={`stat-card ${filterType === 'low' ? 'is-active' : ''}`}
              onClick={() => setFilterType('low')}
              style={{ padding: '16px 20px', border: filterType === 'low' ? '2px solid var(--err)' : '1px solid #fee2e2', background: '#fff', cursor: 'pointer' }}>
              <div className="stat-card__left">
                <div className="stat-card__label">Low Stock Items</div>
                <div className="stat-card__value" style={{ color: 'var(--err)', fontSize: 32 }}>
                  {items.filter(i => (i.remainQuantity || 0) <= 5).length}
                </div>
                <div className="stat-card__sub">below safety level</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fef2f2', color: 'var(--err)', display: 'grid', placeItems: 'center' }}>
                <IcoAlert />
              </div>
            </div>
            <div className={`stat-card ${filterType === 'inactive' ? 'is-active' : ''}`}
              onClick={() => setFilterType('inactive')}
              style={{ padding: '16px 20px', border: filterType === 'inactive' ? '2px solid var(--ink-400)' : '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
              <div className="stat-card__left">
                <div className="stat-card__label">Inactive items</div>
                <div className="stat-card__value" style={{ color: 'var(--ink-500)', fontSize: 32 }}>
                  {items.filter(i => i.useYn === 'N').length}
                </div>
                <div className="stat-card__sub">deactivated in EBM</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--ink-50)', color: 'var(--ink-400)', display: 'grid', placeItems: 'center' }}>
                <IcoCheck />
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            STATUS VIEW
        ═══════════════════════════════════════════════════ */}
        {viewTab === 'Status' && (
          <div className="card" style={{ border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: 16 }}>
            <div className="table-wrap" style={{ borderRadius: 16, border: '1px solid var(--ink-200)' }}>
              {loading ? (
                <div style={{ padding: 80, textAlign: 'center' }}><div className="spinner-sm" style={{ margin: '0 auto 12px' }} />Loading inventory...</div>
              ) : (
                <table className="data">
                  <thead style={{ background: 'var(--ink-50)' }}>
                    <tr>
                      <th style={{ padding: '14px 20px' }}>Product & Unit</th>
                      <th>Item Code</th>
                      <th className="num">Price (RWF)</th>
                      <th style={{ minWidth: 140 }}>Current Stock</th>
                      <th>Tax</th>
                      <th>Status</th>
                      <th style={{ width: 180 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: 60, color: 'var(--ink-400)' }}>No items found matching filters</td></tr>
                    ) : filteredItems.map((item, idx) => {
                      const stockVal = Number(item.remainQuantity || 0)
                      const isLow = stockVal <= 5
                      const initials = item.name.slice(0, 2).toUpperCase()

                      return (
                        <tr key={item.id}>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 34, height: 34, borderRadius: 8, background: idx % 2 === 0 ? 'var(--brand-50)' : '#f0fdf4', color: idx % 2 === 0 ? 'var(--brand-600)' : 'var(--ok)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11 }}>
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--ink-900)', fontSize: 14 }}>{item.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>{item.quantityUnitCode} • {item.barcode || 'No barcode'}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className="mono" style={{ fontSize: 11.5, background: 'var(--ink-50)', padding: '2px 6px', borderRadius: 4, color: 'var(--ink-700)' }}>{item.code}</span></td>
                          <td className="num"><span style={{ fontWeight: 700, fontSize: 14 }}>{Number(item.defaultUnitPrice || 0).toLocaleString()}</span></td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                <span style={{ fontWeight: 800, fontSize: 16, color: stockVal <= 0 ? 'var(--err)' : isLow ? 'var(--warn)' : 'var(--ok)' }}>
                                  {stockVal.toLocaleString()}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 500 }}>{item.quantityUnitCode}</span>
                              </div>
                              <div style={{ height: 4, background: 'var(--ink-100)', borderRadius: 2, overflow: 'hidden', width: 100 }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.min((stockVal / 100) * 100, 100)}%`,
                                  background: stockVal <= 0 ? 'var(--err)' : isLow ? 'var(--warn)' : 'var(--ok)',
                                  borderRadius: 2
                                }} />
                              </div>
                            </div>
                          </td>
                          <td><span className="chip chip--plain" style={{ background: 'var(--ink-50)', color: 'var(--ink-600)', fontSize: 10, fontWeight: 700 }}>VAT {item.taxTypeCode}</span></td>
                          <td>
                            <span className={`chip ${item.useYn === 'Y' ? 'chip--ok' : 'chip--err'}`} style={{ fontSize: 10, borderRadius: 6, padding: '1px 8px' }}>
                              {item.useYn === 'Y' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="cell-actions" style={{ paddingRight: 20 }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn--sm btn--ghost" title="View Details" onClick={() => setViewingItem(item)} style={{ background: 'var(--ink-50)' }}><IcoEye /></button>
                              <button className="btn btn--sm btn--ghost" title="Update Quantity" onClick={() => openManage(item, 'Stock')} style={{ background: 'var(--brand-50)', color: 'var(--brand-600)' }}><IcoTarget /></button>
                              <button className="btn btn--sm btn--ghost" title="Edit Info" onClick={() => openManage(item, 'Info')} style={{ background: 'var(--ink-50)' }}><IcoEdit /></button>
                              <button className="btn btn--sm btn--ghost" title="Deactivate Item" onClick={() => handleDelete(item)} style={{ color: 'var(--err)', background: '#fff5f5' }}><IcoDelete /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {!loading && total > PER_PAGE && (
              <div className="pagination">
                <span>Showing page {page} of {lastPage}</span>
                <div className="pages">
                  <button disabled={page === 1} onClick={() => loadStatus(page - 1)}>‹</button>
                  <button disabled={page >= lastPage} onClick={() => loadStatus(page + 1)}>›</button>
                </div>
              </div>
            )}
          </div>
        )}

        {viewTab === 'History' && (
          <div className="card" style={{ border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: 16 }}>
            <div className="table-wrap" style={{ borderRadius: 16, border: '1px solid var(--ink-200)' }}>
              {histLoading ? (
                <div style={{ padding: 80, textAlign: 'center' }}><div className="spinner-sm" style={{ margin: '0 auto 12px' }} />Loading history...</div>
              ) : (
                <table className="data">
                  <thead style={{ background: 'var(--ink-50)' }}>
                    <tr>
                      <th style={{ padding: '14px 20px' }}>Timestamp</th>
                      <th>Operation Type</th>
                      <th>Reference</th>
                      <th>Balance Flow (Change → New)</th>
                      <th className="num">Total Value</th>
                      <th>System Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                       <tr><td colSpan="6" style={{ textAlign: 'center', padding: 60, color: 'var(--ink-400)' }}>No recorded movements found</td></tr>
                    ) : history.map(h => {
                      const type = MOVEMENT_TYPES.find(t => t.v === h.storedAndReleasedType)
                      const isIncoming = type?.dir === 'IN'
                      
                      return (
                        <tr key={h.id}>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--ink-900)' }}>{new Date(h.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>{new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ 
                                width: 28, height: 28, borderRadius: 8, 
                                background: isIncoming ? '#f0fdf4' : '#fff1f2', 
                                color: isIncoming ? 'var(--ok)' : 'var(--err)', 
                                display: 'grid', placeItems: 'center' 
                              }}>
                                {isIncoming ? <IcoArrowDown /> : <IcoArrowUp />}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink-800)' }}>{type?.l || h.storedAndReleasedType}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: isIncoming ? 'var(--ok)' : 'var(--err)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{isIncoming ? 'Stock Inbound' : 'Stock Outbound'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="mono"><span style={{ background: 'var(--ink-50)', padding: '2px 8px', borderRadius: 6, fontSize: 11.5 }}>#{h.storedAndReleasedNo}</span></td>
                          <td>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 800, color: isIncoming ? 'var(--ok)' : 'var(--err)', fontSize: 15 }}>
                                   {isIncoming ? '+' : '-'}{Math.abs(h.totalItem || 0)}
                                </span>
                                <span style={{ color: 'var(--ink-300)', fontWeight: 300 }}>→</span>
                                <span style={{ fontWeight: 900, color: 'var(--ink-900)', fontSize: 15 }}>{h.totalItem} <small style={{ fontSize: 10, fontWeight: 400, color: 'var(--ink-400)' }}>Final</small></span>
                             </div>
                          </td>
                          <td className="num"><span style={{ fontWeight: 800, fontSize: 14 }}>{Number(h.totalAmount || 0).toLocaleString()}</span> <span style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 400 }}>RWF</span></td>
                          <td><span className="chip chip--plain" style={{ background: 'var(--ink-50)', color: 'var(--ink-500)', fontSize: 10, borderRadius: 6, padding: '2px 10px' }}>Synced</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Adjust/Movement Form ── */}
        {viewTab === 'Adjust' && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
             <div className="card" style={{ padding: 32, borderRadius: 16 }}>
                <h2 style={{ fontSize: 20, marginBottom: 8 }}>Record Stock Movement</h2>
                <p style={{ color: 'var(--ink-500)', fontSize: 14, marginBottom: 32 }}>Manually record inbound or outbound movements for any item.</p>
                
                {moveOk && <div style={{ background: 'var(--ok-50)', color: 'var(--ok-700)', padding: 16, borderRadius: 12, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}><IcoCheck /> Stock movement recorded successfully!</div>}
                {moveErr && <div className="settings-error" style={{ marginBottom: 24 }}>{moveErr}</div>}

                <form onSubmit={handleMovement}>
                   <div className="form-group">
                      <label className="form-label">Search Product</label>
                      <div className="field" style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, height: 48 }}>
                        <IcoSearch />
                        <input style={{ border: 0, background: 'transparent', outline: 0, fontSize: 14, width: '100%' }}
                          placeholder="Type product name or code..."
                          value={searchQuery}
                          onChange={e => searchItemsInForm(e.target.value)} />
                      </div>
                      
                      {itemList.length > 0 && (
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 8, left: 0, right: 0, background: '#fff', border: '1px solid var(--ink-200)', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 250, overflow: 'auto' }}>
                             {itemList.map(it => (
                               <div key={it.id} onClick={() => { setMoveForm({...moveForm, itemCd: it.code, unitCost: it.defaultUnitPrice}); setItemList([]); setSearchQuery(it.name) }}
                                 style={{ padding: '12px 16px', borderBottom: '1px solid var(--ink-50)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                                 <span style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</span>
                                 <span className="mono" style={{ fontSize: 11, color: 'var(--ink-400)' }}>{it.code}</span>
                               </div>
                             ))}
                          </div>
                        </div>
                      )}
                   </div>

                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
                      <div className="form-group">
                         <label className="form-label">Movement Type</label>
                         <select className="form-input" value={moveForm.storedAndReleasedType} onChange={e => setMoveForm({...moveForm, storedAndReleasedType: e.target.value})}>
                            {MOVEMENT_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                         </select>
                      </div>
                      <div className="form-group">
                         <label className="form-label">Quantity</label>
                         <input className="form-input mono" type="number" required value={moveForm.quantity} onChange={e => setMoveForm({...moveForm, quantity: e.target.value})} />
                      </div>
                   </div>

                   <div className="form-group" style={{ marginTop: 16 }}>
                      <label className="form-label">Unit Cost (RWF)</label>
                      <input className="form-input mono" type="number" required value={moveForm.unitCost} onChange={e => setMoveForm({...moveForm, unitCost: e.target.value})} />
                   </div>

                   {/* Reason — mandatory for adjustment types 06/16 */}
                   {ADJUSTMENT_TYPES.includes(moveForm.storedAndReleasedType) && (
                     <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, border: '2px solid var(--brand-300,#93c5fd)', background: 'var(--brand-50,#eff6ff)' }}>
                       <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--brand-700)', marginBottom: 10 }}>
                         Adjustment reason required (RRA §9.2)
                       </div>
                       <div className="form-group" style={{ marginBottom: 10 }}>
                         <label className="form-label">Reason code <span style={{ color: 'var(--err)' }}>*</span></label>
                         <select className="form-input" value={moveForm.remark} onChange={e => setMoveForm({...moveForm, remark: e.target.value})} required>
                           <option value="">— Select reason —</option>
                           {ADJUSTMENT_REASONS.map(r => (
                             <option key={r.v} value={r.v}>{r.v} · {r.l}</option>
                           ))}
                         </select>
                       </div>
                       {moveForm.remark === '05' && (
                         <div className="form-group" style={{ marginBottom: 0 }}>
                           <label className="form-label">Describe the reason <span style={{ color: 'var(--err)' }}>*</span></label>
                           <input className="form-input" placeholder="Explain the reason for this adjustment…"
                             value={moveForm.remarkNote || ''}
                             onChange={e => setMoveForm({...moveForm, remarkNote: e.target.value})} />
                         </div>
                       )}
                     </div>
                   )}

                   <div style={{ marginTop: 24 }}>
                      <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%', height: 52, borderRadius: 12 }} disabled={moveSaving || !moveForm.itemCd}>
                         {moveSaving ? 'Recording Movement...' : 'Record Stock Movement'}
                      </button>
                   </div>
                </form>
             </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            INVENTORY COUNT VIEW
        ═══════════════════════════════════════════════════ */}
        {viewTab === 'Count' && (
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <div className="card" style={{ borderRadius: 16, overflow: 'visible' }}>
              <div className="card__head" style={{ borderBottom: '1px solid var(--ink-100)', padding: '20px 28px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Stock Reconciliation</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-500)' }}>Set the actual physical stock count — replaces the current balance in the system</p>
                </div>
                <button className="btn btn--ghost" onClick={handleSync} disabled={syncing || isTrainingMode}
                  title={isTrainingMode ? 'Disabled in Training Mode' : undefined}
                  style={{ border: '1px solid var(--ink-200)', height: 38, padding: '0 16px', fontSize: 13, fontWeight: 600 }}>
                  {syncing ? 'Syncing...' : 'Sync from RRA'}
                </button>
              </div>

              <div className="card__body" style={{ padding: 32 }}>
                {syncMsg && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14, color: 'var(--ok)', marginBottom: 24, fontWeight: 600, fontSize: 13 }}>
                    {syncMsg}
                  </div>
                )}
                {countErr && <div className="settings-error" style={{ marginBottom: 24 }}>{countErr}</div>}
                {countOk  && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, color: 'var(--ok)', marginBottom: 24, fontWeight: 600 }}>
                    Inventory count updated successfully
                  </div>
                )}

                <form onSubmit={handleMaster}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 32px' }}>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Search Product <span style={{ color: 'var(--err)' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                        <input className="form-input" placeholder="Type product name or code to search..."
                          value={countSearchQuery}
                          onChange={e => searchCountItems(e.target.value)} />
                        {countSearching && <div className="spinner-sm" style={{ position: 'absolute', right: 12, top: 12 }} />}
                        {countSearchQuery.length >= 2 && !countSearching && (
                          <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4, maxHeight: 250, overflowY: 'auto', border: '1px solid var(--ink-200)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
                            {countItemList.length === 0 ? (
                              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>No products matching "{countSearchQuery}"</div>
                            ) : countItemList.map(it => (
                              <div key={it.id} className="item-select-row"
                                style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                onClick={() => {
                                  setCountForm(f => ({ ...f, itemCode: it.code }))
                                  setCountSearchQuery(it.name)
                                  setCountItemList([])
                                }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{it.code}</div>
                                </div>
                                <span className="chip chip--plain" style={{ fontSize: 11 }}>{it.taxTypeCode}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">RRA Item Code</label>
                      <input className="form-input mono" required readOnly value={countForm.itemCode} placeholder="Select a product above" style={{ background: 'var(--ink-50)' }} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Physical Quantity Counted</label>
                      <input className="form-input mono" type="number" min="0" required
                        placeholder="Enter the total you physically counted"
                        value={countForm.remainQuantity}
                        onChange={e => setCountForm(f => ({ ...f, remainQuantity: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ marginTop: 24, padding: '14px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, fontSize: 13, color: '#92400e' }}>
                    <b>Important:</b> This directly sets the quantity in the InfraMonitor server to the number you enter. Only use this after a physical stock audit.
                  </div>

                  {isTrainingMode && (
                    <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                      Inventory Count is disabled in Training Mode. Disable training mode to perform stock reconciliation.
                    </div>
                  )}
                  <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--ink-100)', paddingTop: 24 }}>
                    <button type="submit" className="btn btn--lg btn--primary" style={{ padding: '0 40px' }} disabled={countSaving || !countForm.itemCode || !countForm.remainQuantity || isTrainingMode}>
                      {countSaving ? 'Updating...' : 'Update Count'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSFER TAB (F-20) ── */}
        {viewTab === 'Transfer' && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div className="card">
              <div className="card__head">
                <div>
                  <h3 style={{ margin: 0 }}>Branch Transfer</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>
                    Move stock from this branch to another branch under the same TIN. Both branches are updated in EBM.
                  </p>
                </div>
              </div>
              <div className="card__body">
                {transferErr && <div className="settings-error" style={{ marginBottom: 14 }}>{transferErr}</div>}
                {transferOk && (
                  <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: 'var(--ok)', fontWeight: 600 }}>
                    ✓ {transferOk}
                  </div>
                )}

                <form onSubmit={handleTransfer}>
                  {/* Item search */}
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label">Item to transfer <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input
                      className="form-input"
                      placeholder="Search item name or code…"
                      value={transferSearch}
                      onChange={e => searchTransferItems(e.target.value)}
                      autoComplete="off"
                    />
                    {transferForm.itemCode && (
                      <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                        Selected: <strong>{transferForm.itemCode}</strong> — {transferForm.itemName}
                      </div>
                    )}
                    {transferItems.length > 0 && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 8, zIndex: 10, boxShadow: '0 6px 20px rgba(0,0,0,.12)', maxHeight: 200, overflowY: 'auto' }}>
                        {transferItems.map((it, i) => (
                          <div key={it.id || it.code}
                            onClick={() => { setTransferForm(f => ({ ...f, itemCode: it.code, itemName: it.name })); setTransferSearch(it.name); setTransferItems([]) }}
                            style={{ padding: '9px 14px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--ink-100)' : 'none', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <span style={{ fontWeight: 600 }}>{it.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{it.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    <div className="form-group">
                      <label className="form-label">Quantity <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input className="form-input input--mono" type="number" required min="1" step="0.01"
                        value={transferForm.quantity} onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Destination branch <span style={{ color: 'var(--err)' }}>*</span></label>
                      <select className="form-input" required value={transferForm.toBranchId} onChange={e => setTransferForm(f => ({ ...f, toBranchId: e.target.value }))}>
                        <option value="">— Select branch —</option>
                        {branches.filter(b => b.branchId !== branchId).map(b => (
                          <option key={b.branchId} value={b.branchId}>{b.branchName || b.branchId} ({b.branchId})</option>
                        ))}
                      </select>
                      {branches.filter(b => b.branchId !== branchId).length === 0 && (
                        <span className="form-hint">No other branches found under your TIN.</span>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef9c3', border: '1px solid #fde047', fontSize: 12.5, color: '#92400e', marginBottom: 20 }}>
                    <strong>§9.4:</strong> Both branches are updated in EBM (OUT from this branch, IN at destination).
                    Only branches under the same TIN are shown. Transfer cannot be reversed once confirmed.
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn--primary" disabled={transferSaving || !transferForm.itemCode || !transferForm.toBranchId}>
                      {transferSaving ? 'Transferring…' : 'Confirm Transfer'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── MASTERS TAB ── */}
        {viewTab === 'Masters' && (
          <div className="card">
            <div className="filterbar">
              <div className="field" style={{ flex: 1 }}>
                <IcoSearch />
                <input
                  placeholder="Filter by item name or code…"
                  value={mastersSearch}
                  onChange={e => setMastersSearch(e.target.value)}
                />
              </div>
              <button className="btn btn--sm" onClick={() => loadMasters(mastersPage)} disabled={mastersLoading}>
                {mastersLoading ? 'Loading…' : '↻ Refresh'}
              </button>
            </div>

            {mastersLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)' }}>Loading stock balances…</div>
            ) : masters.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-500)' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>No stock master records found</div>
                <div style={{ fontSize: 13 }}>Save an inventory count or receive stock to create balance records.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Item Code</th>
                      <th className="num">Balance (Qty)</th>
                      <th>Branch</th>
                      <th>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masters
                      .filter(m => {
                        if (!mastersSearch.trim()) return true
                        const q = mastersSearch.toLowerCase()
                        return (m.itemName || '').toLowerCase().includes(q) || m.itemCode.toLowerCase().includes(q)
                      })
                      .map(m => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>{m.itemName || m.itemCode}</td>
                          <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.itemCode}</span></td>
                          <td className="num">
                            <span style={{
                              fontWeight: 700,
                              color: m.remainQuantity <= 0 ? 'var(--err)' : m.remainQuantity < 10 ? '#b45309' : 'var(--ok)',
                              fontVariantNumeric: 'tabular-nums',
                            }}>
                              {Number(m.remainQuantity ?? 0).toLocaleString()}
                            </span>
                            {m.remainQuantity <= 0 && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--err)' }}>OUT</span>}
                            {m.remainQuantity > 0 && m.remainQuantity < 10 && <span style={{ marginLeft: 6, fontSize: 10, color: '#b45309' }}>LOW</span>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ink-500)' }}>{m.branchId || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-500)' }}>{m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!mastersLoading && mastersLast > 1 && (
              <div className="pagination">
                <span>Showing {masters.length} of {mastersTotal} records</span>
                <div className="pages">
                  <button disabled={mastersPage <= 1} onClick={() => loadMasters(mastersPage - 1)}>‹</button>
                  <button disabled={mastersPage >= mastersLast} onClick={() => loadMasters(mastersPage + 1)}>›</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Unified Management Modal (Stock quantity / Product info) ── */}
      {manageItem && (
        <div className="modal-backdrop" onClick={() => setManageItem(null)}>
           <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
              <div className="modal__head">
                 <div>
                   <h3 style={{ margin: 0 }}>{manageItem.name}</h3>
                   <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{manageItem.code}</div>
                 </div>
                 <button className="modal__close" onClick={() => setManageItem(null)}>✕</button>
              </div>

              <div style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid var(--ink-100)' }}>
                {[['Stock', 'Update Quantity'], ['Info', 'Product Details']].map(([id, label]) => (
                  <button key={id} type="button"
                    onClick={() => setManageTab(id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px', marginRight: 20,
                      fontSize: 13, fontWeight: 600,
                      color: manageTab === id ? 'var(--brand-700)' : 'var(--ink-500)',
                      borderBottom: manageTab === id ? '2px solid var(--brand-600)' : '2px solid transparent',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {manageTab === 'Stock' ? (
                <div className="modal__body">
                  <div style={{ background: 'var(--ink-50)', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase', fontWeight: 700 }}>Current Quantity</div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{Number(manageItem.remainQuantity || 0).toLocaleString()} <small style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-500)' }}>{manageItem.quantityUnitCode}</small></div>
                  </div>

                  <form onSubmit={handleAudit}>
                    <div className="form-group">
                      <label className="form-label">How do you want to update it?</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn--sm" onClick={() => setAuditMode('reset')}
                          style={{ flex: 1, background: auditMode === 'reset' ? 'var(--brand-600)' : 'var(--ink-50)', color: auditMode === 'reset' ? '#fff' : 'var(--ink-600)', border: 'none' }}>
                          Set to exact count
                        </button>
                        <button type="button" className="btn btn--sm" onClick={() => setAuditMode('add')}
                          style={{ flex: 1, background: auditMode === 'add' ? 'var(--brand-600)' : 'var(--ink-50)', color: auditMode === 'add' ? '#fff' : 'var(--ink-600)', border: 'none' }}>
                          Add / Remove
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        {auditMode === 'reset' ? 'New Quantity' : 'Amount (use a negative number to remove)'}
                      </label>
                      <input className="form-input mono" type="number" step="any" required
                        value={auditQty} onChange={e => setAuditQty(e.target.value)} autoFocus />
                      <span className="form-hint">
                        {auditMode === 'reset'
                          ? 'Replaces the current quantity outright — use after a physical count.'
                          : 'Adds to (positive) or subtracts from (negative) the current quantity — sent to EBM as a §4.15 Adjustment movement.'}
                      </span>
                    </div>

                    <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                       <button type="button" className="btn btn--ghost" onClick={() => setManageItem(null)}>Cancel</button>
                       <button type="submit" className="btn btn--primary" disabled={auditSaving}>{auditSaving ? 'Updating...' : 'Update Quantity'}</button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="modal__body">
                   <form onSubmit={handleUpdate}>
                      {saveErr && <div className="settings-error" style={{ marginBottom: 16 }}>{saveErr}</div>}
                      <div className="form-group">
                        <label className="form-label">Product Name</label>
                        <input className="form-input" required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group">
                          <label className="form-label">Unit Price (RWF)</label>
                          <input className="form-input mono" type="number" required value={editForm.defaultUnitPrice} onChange={e => setEditForm({...editForm, defaultUnitPrice: e.target.value})} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Tax Type</label>
                          <select className="form-input" value={editForm.taxTypeCode} onChange={e => setEditForm({...editForm, taxTypeCode: e.target.value})}>
                            <option value="A">A — Exempt</option>
                            <option value="B">B — 18% Standard</option>
                            <option value="C">C — Zero Rated</option>
                            <option value="D">D — Special</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Status</label>
                        <select className="form-input" value={editForm.useYn} onChange={e => setEditForm({...editForm, useYn: e.target.value})}>
                          <option value="Y">Active</option>
                          <option value="N">Inactive</option>
                        </select>
                      </div>
                      <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                         <button type="button" className="btn btn--ghost" onClick={() => setManageItem(null)}>Cancel</button>
                         <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Update Details'}</button>
                      </div>
                   </form>
                </div>
              )}
           </div>
        </div>
      )}

      {/* ── View More Modal ── */}
      {viewingItem && (
        <div className="modal-backdrop" onClick={() => setViewingItem(null)}>
           <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
              <div className="modal__head">
                 <h3 style={{ margin: 0 }}>Product Insights</h3>
                 <button className="modal__close" onClick={() => setViewingItem(null)}>✕</button>
              </div>
              <div className="modal__body">
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
                    <div style={{ background: 'var(--ink-50)', padding: 16, borderRadius: 12 }}>
                       <div style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>EBM Details</div>
                       <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Item Code:</span> <b className="mono">{viewingItem.code}</b></div>
                       <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Tax Code:</span> <b>{viewingItem.taxTypeCode}</b></div>
                       <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}><span>Unit:</span> <b>{viewingItem.quantityUnitCode}</b></div>
                    </div>
                    <div style={{ background: 'var(--brand-50)', padding: 16, borderRadius: 12 }}>
                       <div style={{ fontSize: 11, color: 'var(--brand-600)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Current Status</div>
                       <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-700)' }}>{viewingItem.remainQuantity} <small style={{ fontSize: 12, fontWeight: 400 }}>{viewingItem.quantityUnitCode}</small></div>
                       <div style={{ fontSize: 12, color: 'var(--brand-600)', marginTop: 4 }}>Level: {Number(viewingItem.remainQuantity) > 5 ? 'Healthy' : 'Low Stock'}</div>
                    </div>
                 </div>
                 
                 <div style={{ borderTop: '1px solid var(--ink-100)', paddingTop: 20 }}>
                    <h4 style={{ margin: '0 0 16px', fontSize: 15 }}>Performance & Logic</h4>
                    <div style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.6 }}>
                       This product is currently <b>{viewingItem.useYn === 'Y' ? 'Active' : 'Inactive'}</b> in the EBM system. 
                       It is categorized as a <b>{viewingItem.typeCode === '1' ? 'Raw Material' : 'Finished Good'}</b>. 
                       The last reported price was <b>{Number(viewingItem.defaultUnitPrice).toLocaleString()} RWF</b>.
                    </div>
                 </div>

                 <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn--primary" onClick={() => setViewingItem(null)}>Close View</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </AppShell>
  )
}
