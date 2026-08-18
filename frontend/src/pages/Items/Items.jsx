import { useState, useEffect, useCallback } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'
import ClassificationPicker from '../../components/ui/ClassificationPicker'
import ItemCompositionModal from './components/ItemCompositionModal'
import ItemDetailView from './components/ItemDetailView'
import { useReferenceCodes } from '../../hooks/useReferenceCodes'
import { useApp } from '../../context/AppContext'

// ── Constants ──────────────────────────────────────────────────────────────
const PER_PAGE = 5

const TYPE_CODES = [
  { v: '1', l: 'Raw Material' },
  { v: '2', l: 'Finished Product' },
  { v: '3', l: 'Service (no stock check)' },
  { v: '4', l: 'Composed / Bundle' },
]
const TAX_OPTS = [
  { v: 'A', l: 'A · Exempt (0%)' },
  { v: 'B', l: 'B · Standard VAT (18%)' },
  { v: 'C', l: 'C · Zero-rated (0%)' },
  { v: 'D', l: 'D · Non-VAT' },
]
const TAX_LABEL  = { A: 'A Exempt', B: 'B 18%', C: 'C Zero', D: 'D Non-VAT' }
const TAX_COLORS = { A: 'tax-A',    B: 'tax-B',  C: 'tax-C',  D: 'tax-D' }
const QTY_UNITS = [
  { v: 'U',   l: 'U · Unit' },   { v: 'KGM', l: 'KGM · Kilogram' },
  { v: 'GRM', l: 'GRM · Gram' }, { v: 'MGM', l: 'MGM · Milligram' },
  { v: 'TNE', l: 'TNE · Tonne' },{ v: 'LTR', l: 'LTR · Litre' },
  { v: 'L',   l: 'L · Litre' },  { v: 'GLL', l: 'GLL · Gallon' },
  { v: 'MTR', l: 'MTR · Metre' },{ v: 'M',   l: 'M · Metre' },
  { v: 'CMT', l: 'CMT · Centimetre' }, { v: 'M2', l: 'M2 · Square Metre' },
  { v: 'M3',  l: 'M3 · Cubic Metre' }, { v: 'DZ', l: 'DZ · Dozen' },
  { v: 'SET', l: 'SET · Set' },  { v: 'BX',  l: 'BX · Box' },
  { v: 'BG',  l: 'BG · Bag' },   { v: 'BLL', l: 'BLL · Bottle' },
  { v: 'NO',  l: 'NO · Number' },{ v: 'PA',  l: 'PA · Packet' },
  { v: 'ST',  l: 'ST · Sheet' }, { v: 'RL',  l: 'RL · Reel' },
  { v: 'RO',  l: 'RO · Roll' },
]
const PKG_UNITS = [
  { v: 'CT',  l: 'CT · Carton' },  { v: 'CTN', l: 'CTN · Container' },
  { v: 'BG',  l: 'BG · Bag' },     { v: 'CA',  l: 'CA · Can' },
  { v: 'AM',  l: 'AM · Ampoule' }, { v: 'BA',  l: 'BA · Barrel' },
  { v: 'BE',  l: 'BE · Bundle' },  { v: 'BL',  l: 'BL · Bale' },
  { v: 'BJ',  l: 'BJ · Bucket' },  { v: 'BK',  l: 'BK · Basket' },
  { v: 'CH',  l: 'CH · Chest' },   { v: 'CY',  l: 'CY · Cylinder' },
  { v: 'JR',  l: 'JR · Jar' },     { v: 'NT',  l: 'NT · Net' },
  { v: 'PU',  l: 'PU · Traypack' },{ v: 'RL',  l: 'RL · Reel' },
  { v: 'RO',  l: 'RO · Roll' },    { v: 'SK',  l: 'SK · Skeletoncase' },
  { v: 'TY',  l: 'TY · Tank' },
]
const COUNTRY_CODES = ['RW','KE','UG','TZ','BI','CD','US','GB','CN','IN','FR','DE','BE','ZA']

const AVATAR_COLORS = [
  { bg: 'var(--brand-100)', color: 'var(--brand-700)' },
  { bg: '#dcfce7', color: 'var(--ok)' },
  { bg: '#fef3c7', color: '#b45309' },
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#cffafe', color: '#0e7490' },
  { bg: '#ffe4e6', color: '#be123c' },
]

const EMPTY_FORM = {
  countryCode: 'RW', productType: '2', packingUnit: 'CT', quantityUnit: 'U',
  classificationCode: '', typeCode: '2', name: '', originalNationCode: 'RW',
  packagingUnitCode: 'CT', quantityUnitCode: 'U', taxTypeCode: 'B',
  defaultUnitPrice: '', batchNo: '', barcode: '',
  insuranceApplicableYn: 'N', useYn: 'Y', cisProductId: '',
  groupPriceOne: '', groupPriceTwo: '', groupPriceThree: '',
  groupPriceFour: '', groupPriceFive: '', saftyQuantity: '',
}

// ── Helpers ────────────────────────────────────────────────────────────────
function avatarColor(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function generateBatchNo() {
  const d = new Date()
  const ymd = d.getFullYear().toString().slice(-2)
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0')
  const rnd = String(Math.floor(Math.random() * 99)).padStart(2, '0')
  return ymd + rnd
}

function generateBarcode() {
  return String(Math.floor(10000000 + Math.random() * 90000000))
}

function getPageNums(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (cur <= 4)        return [1, 2, 3, 4, 5, '…', total]
  if (cur >= total - 3) return [1, '…', total-4, total-3, total-2, total-1, total]
  return [1, '…', cur-1, cur, cur+1, '…', total]
}

function exportCSVData(rows) {
  const hdr = ['Name','Code','Classification','Tax','Price (RWF)','Status','Origin','Barcode']
  const csv = [hdr, ...rows.map(i => [
    `"${(i.name||'').replace(/"/g,'""')}"`, i.code||'', i.classificationCode||'',
    TAX_LABEL[i.taxTypeCode]||i.taxTypeCode||'', i.defaultUnitPrice||'',
    i.useYn==='Y'?'Active':'Inactive', i.originalNationCode||'', i.barcode||''
  ])].map(r => r.join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = `items_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

function exportExcelData(rows) {
  const hdr = ['Name','Code','Classification','Tax','Price (RWF)','Status','Origin','Barcode']
  const data = rows.map(i => [
    i.name||'', i.code||'', i.classificationCode||'',
    TAX_LABEL[i.taxTypeCode]||i.taxTypeCode||'', i.defaultUnitPrice||'',
    i.useYn==='Y'?'Active':'Inactive', i.originalNationCode||'', i.barcode||''
  ])
  const csv = [hdr, ...data].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`.trim()).join('\t')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8;' }))
  a.download = `items_${new Date().toISOString().slice(0,10)}.xls`
  a.click()
}

async function exportAllExcel(search) {
  try {
    let allItems = []
    if (search.trim()) {
      let page = 1, hasMore = true
      while (hasMore) {
        const res = await operatorApi.searchItems(search, page)
        allItems = [...allItems, ...(res?.data ?? [])]
        hasMore = (res?.meta?.currentPage ?? 0) < (res?.meta?.lastPage ?? 0)
        page++
      }
    } else {
      let page = 1, hasMore = true
      while (hasMore) {
        const res = await operatorApi.listItems(page)
        allItems = [...allItems, ...(res?.items?.data ?? [])]
        hasMore = (res?.items?.meta?.currentPage ?? 0) < (res?.items?.meta?.lastPage ?? 0)
        page++
      }
    }
    exportExcelData(allItems)
  } catch (err) {
    alert('Error exporting data: ' + err.message)
  }
}

async function exportAllCSV(search) {
  try {
    let allItems = []
    if (search.trim()) {
      let page = 1, hasMore = true
      while (hasMore) {
        const res = await operatorApi.searchItems(search, page)
        allItems = [...allItems, ...(res?.data ?? [])]
        hasMore = (res?.meta?.currentPage ?? 0) < (res?.meta?.lastPage ?? 0)
        page++
      }
    } else {
      let page = 1, hasMore = true
      while (hasMore) {
        const res = await operatorApi.listItems(page)
        allItems = [...allItems, ...(res?.items?.data ?? [])]
        hasMore = (res?.items?.meta?.currentPage ?? 0) < (res?.items?.meta?.lastPage ?? 0)
        page++
      }
    }
    exportCSVData(allItems)
  } catch (err) {
    alert('Error exporting data: ' + err.message)
  }
}

function printTableData(rows) {
  const hdr = ['Name','Code','Classification','Tax','Price (RWF)','Status','Origin','Barcode']
  let html = '<html><head><style>body{font-family:Arial,sans-serif;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:bold}</style></head><body>'
  html += '<h2>Item Catalog Export</h2>'
  html += '<table><thead><tr>' + hdr.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>'
  html += rows.map(i => '<tr><td>' + [
    i.name||'', i.code||'', i.classificationCode||'',
    TAX_LABEL[i.taxTypeCode]||i.taxTypeCode||'', i.defaultUnitPrice||'',
    i.useYn==='Y'?'Active':'Inactive', i.originalNationCode||'', i.barcode||''
  ].join('</td><td>') + '</td></tr>').join('')
  html += '</tbody></table></body></html>'
  const printWindow = window.open('', '', 'width=1200,height=600')
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.print()
}

async function printAllData(search) {
  try {
    let allItems = []
    if (search.trim()) {
      let page = 1, hasMore = true
      while (hasMore) {
        const res = await operatorApi.searchItems(search, page)
        allItems = [...allItems, ...(res?.data ?? [])]
        hasMore = (res?.meta?.currentPage ?? 0) < (res?.meta?.lastPage ?? 0)
        page++
      }
    } else {
      let page = 1, hasMore = true
      while (hasMore) {
        const res = await operatorApi.listItems(page)
        allItems = [...allItems, ...(res?.items?.data ?? [])]
        hasMore = (res?.items?.meta?.currentPage ?? 0) < (res?.items?.meta?.lastPage ?? 0)
        page++
      }
    }
    printTableData(allItems)
  } catch (err) {
    alert('Error preparing print: ' + err.message)
  }
}

// ── Icons ──────────────────────────────────────────────────────────────────
const IcoRefresh = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
const IcoPdf    = () => <svg width="28" height="28" viewBox="0 0 64 64" fill="none"><path d="M12 4h32l16 16v36c0 4.4-3.6 8-8 8H12c-4.4 0-8-3.6-8-8V12c0-4.4 3.6-8 8-8z" fill="#DC2626"/><path d="M44 4v16h16" fill="#B91C1C"/><path d="M22 30h20M22 38h20M22 46h12" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>
const IcoXlsx   = () => <svg width="28" height="28" viewBox="0 0 64 64" fill="none"><path d="M12 4h32l16 16v36c0 4.4-3.6 8-8 8H12c-4.4 0-8-3.6-8-8V12c0-4.4 3.6-8 8-8z" fill="#16A34A"/><path d="M44 4v16h16" fill="#15803D"/><path d="M22 28h20v24H22z" fill="white" fillOpacity="0.2"/><path d="M22 28h20M22 36h20M22 44h20M22 52h20M22 28v24M32 28v24M42 28v24" stroke="white" strokeWidth="1.5"/></svg>
const IcoCsv    = () => <svg width="28" height="28" viewBox="0 0 64 64" fill="none"><path d="M12 4h32l16 16v36c0 4.4-3.6 8-8 8H12c-4.4 0-8-3.6-8-8V12c0-4.4 3.6-8 8-8z" fill="#2563EB"/><path d="M44 4v16h16" fill="#1D4ED8"/><path d="M20 32l8 8 16-16" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoPlus   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const IcoTable  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
const IcoList   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const IcoGrid   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
const IcoBack   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
const IcoSearch = () => <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" strokeLinecap="round"/></svg>
const IcoMagic  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M12.2 6.2 11 5M12.2 11.8 11 13M15 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="m3 21 9-9"/></svg>
const IcoEye    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>

// ── Main component ─────────────────────────────────────────────────────────
export default function Items() {
  const { rawUser } = useApp()
  const branchId = rawUser?.branchId || '00'
  const { codesFor } = useReferenceCodes(branchId)

  // Live from RRA's reference code table, falling back to the static official
  // lists (below) if that category isn't found yet or RRA is unreachable.
  const taxOpts     = codesFor(/tax.?ation/i, TAX_OPTS.map(t => ({ v: t.v, l: t.l })))
  const countryOpts = codesFor(/c.?untry|nation/i, COUNTRY_CODES.map(c => ({ v: c, l: c })))
  const pkgOpts      = codesFor(/packag/i, PKG_UNITS)
  const qtyOpts       = codesFor(/quantity/i, QTY_UNITS)
  const productOpts  = codesFor(/product.?type/i, TYPE_CODES)

  const [items,        setItems]        = useState([])
  const [meta,         setMeta]         = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [pageTab,      setPageTab]      = useState('List') // 'List' | 'Add' | 'Detail'
  const [viewMode,     setViewMode]     = useState('table')
  const [statusFilter, setStatusFilter] = useState('All')
  const [taxFilter,    setTaxFilter]    = useState('')
  const [originFilter, setOriginFilter] = useState('')

  const [ebmSyncStatus, setEbmSyncStatus] = useState('idle')
  const [ebmSyncCount,  setEbmSyncCount]  = useState(null)

  async function handleEbmSync() {
    setEbmSyncStatus('loading')
    try {
      const res = await operatorApi.syncItemsFromEbm()
      setEbmSyncCount(res?.itemsSynced ?? 0)
      setEbmSyncStatus('done')
      load(1)
      setTimeout(() => setEbmSyncStatus('idle'), 4000)
    } catch (err) {
      setEbmSyncStatus('error')
      setTimeout(() => setEbmSyncStatus('idle'), 3000)
    }
  }

  const [detailItem,   setDetailItem]   = useState(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [saveErr,      setSaveErr]      = useState(null)
  const [saveOk,       setSaveOk]       = useState(false)

  const [editItem,     setEditItem]     = useState(null)
  const [editPrice,    setEditPrice]    = useState('')
  const [editSaving,   setEditSaving]   = useState(false)
  const [menuOpen,     setMenuOpen]     = useState(null)
  const [compositionItem, setCompositionItem] = useState(null)

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async (p = 1) => {
    setLoading(true); setError(null)
    try {
      if (search.trim()) {
        const res = await operatorApi.searchItems(search, p)
        setItems(res?.data ?? [])
        setMeta(res?.meta ?? null)
      } else {
        const res = await operatorApi.listItems(p)
        setItems(res?.items?.data ?? [])
        setMeta(res?.items?.meta ?? null)
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load(1) }, [load])

  // ── Form helpers ─────────────────────────────────────────────────────────
  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault(); setSaveErr(null); setSaving(true)
    try {
      const payload = {
        code: { countryCode: form.countryCode, productType: form.productType, packingUnit: form.packingUnit, quantityUnit: form.quantityUnit },
        classificationCode: form.classificationCode,
        typeCode: form.typeCode, name: form.name,
        originalNationCode: form.originalNationCode,
        packagingUnitCode: form.packagingUnitCode,
        quantityUnitCode: form.quantityUnitCode,
        taxTypeCode: form.taxTypeCode,
        defaultUnitPrice: Number(form.defaultUnitPrice),
        insuranceApplicableYn: form.insuranceApplicableYn,
        useYn: form.useYn, cisProductId: form.cisProductId,
      }
      if (form.batchNo)         payload.batchNo         = form.batchNo
      if (form.barcode)         payload.barcode         = form.barcode
      if (form.groupPriceOne)   payload.groupPriceOne   = Number(form.groupPriceOne)
      if (form.groupPriceTwo)   payload.groupPriceTwo   = Number(form.groupPriceTwo)
      if (form.groupPriceThree) payload.groupPriceThree = Number(form.groupPriceThree)
      if (form.groupPriceFour)  payload.groupPriceFour  = Number(form.groupPriceFour)
      if (form.groupPriceFive)  payload.groupPriceFive  = Number(form.groupPriceFive)
      if (form.saftyQuantity)   payload.saftyQuantity   = Number(form.saftyQuantity)
      await operatorApi.createItem(payload)
      logActivity({ action: 'CREATE_ITEM', category: 'System', summary: `Created item "${form.name}" (Tax: ${form.taxTypeCode})` })
      setSaveOk(true); setForm(EMPTY_FORM); load()
      setTimeout(() => setSaveOk(false), 3000)
    } catch (err) {
      setSaveErr(err.data?.errors?.[0]?.message || err.message)
      logActivity({ action: 'CREATE_ITEM', category: 'System', summary: `Failed to create item "${form.name}"`, status: 'error', detail: err.message })
    } finally { setSaving(false) }
  }

  async function handleUpdatePrice(item) {
    setEditSaving(true)
    try {
      await operatorApi.updateItem([{ id: item.id, defaultUnitPrice: Number(editPrice), cisProductId: item.cisProductId || item.code || '' }])
      logActivity({ action: 'UPDATE_ITEM', category: 'System', summary: `Updated price for "${item.name}" to ${editPrice}` })
      setEditItem(null)
      if (detailItem?.id === item.id) setDetailItem({ ...detailItem, defaultUnitPrice: Number(editPrice) })
      load()
    } catch (err) { alert(err.message) }
    finally { setEditSaving(false) }
  }

  async function handleToggleActive(item) {
    try {
      await operatorApi.updateItem([{ id: item.id, useYn: item.useYn === 'Y' ? 'N' : 'Y', cisProductId: item.cisProductId || item.code || '' }])
      logActivity({ action: 'UPDATE_ITEM', category: 'System', summary: `${item.useYn === 'Y' ? 'Deactivated' : 'Activated'} item "${item.name}"` })
      if (detailItem?.id === item.id) setDetailItem({ ...detailItem, useYn: item.useYn === 'Y' ? 'N' : 'Y' })
      load()
    } catch (err) { alert(err.message) }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try {
      await operatorApi.deleteItem(item.code)
      logActivity({ action: 'DELETE_ITEM', category: 'System', summary: `Deleted item "${item.name}" (${item.code})` })
      if (pageTab === 'Detail') backToList()
      load()
    } catch (err) { alert(err.message) }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function openDetail(item) { setDetailItem(item); setPageTab('Detail') }
  function backToList() { setPageTab('List'); setDetailItem(null) }
  function openAdd() { setPageTab('Add'); setForm(EMPTY_FORM); setSaveErr(null); setSaveOk(false) }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = items.filter(i => {
    if (statusFilter === 'Active'   && i.useYn !== 'Y')    return false
    if (statusFilter === 'Inactive' && i.useYn === 'Y')    return false
    if (statusFilter === 'Services' && i.typeCode !== '3') return false
    if (taxFilter    && i.taxTypeCode        !== taxFilter)    return false
    if (originFilter && i.originalNationCode !== originFilter) return false
    return true
  })

  const total       = meta?.total ?? items.length
  const totalPages  = meta ? (meta.lastPage ?? Math.ceil(meta.total / PER_PAGE)) : 1
  const currentPage = meta?.currentPage ?? 1
  const active      = items.filter(i => i.useYn === 'Y').length
  const vatB        = items.filter(i => i.taxTypeCode === 'B').length
  const services    = items.filter(i => i.typeCode === '3').length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="page" onClick={() => setMenuOpen(null)}>

        {/* ── Page header ── */}
        <div className="page-head">
          <div>
            <div className="crumbs">
              <span>Home</span><span>›</span>
              {pageTab === 'List' ? (
                <span>Items &amp; Products</span>
              ) : (
                <>
                  <span style={{ cursor: 'pointer', color: 'var(--brand-600)' }} onClick={backToList}>Items &amp; Products</span>
                  <span>›</span>
                  <span>{pageTab === 'Add' ? 'Register new item' : (detailItem?.name || 'Item details')}</span>
                </>
              )}
            </div>
            <h1>
              {pageTab === 'Add'    ? 'Register new item'
                : pageTab === 'Detail' ? (detailItem?.name || 'Item details')
                : 'Item catalog'}
            </h1>
          </div>
          <div className="page-head__actions">
            {pageTab === 'List' && (
              <>
                <button className="icon-btn" title="Refresh" onClick={() => load(currentPage)}><IcoRefresh /></button>
                <button className="icon-btn" title="Export Excel (all data)" onClick={() => exportAllExcel(search)}><IcoXlsx /></button>
                <button className="icon-btn" title="Export CSV (all data)" onClick={() => exportAllCSV(search)}><IcoCsv /></button>
                <button className="icon-btn" title="Print / PDF (all data)" onClick={() => printAllData(search)}><IcoPdf /></button>
                <button
                  className="btn btn--sm"
                  title="Pull items registered in EBM that are missing from local catalog"
                  onClick={handleEbmSync}
                  disabled={ebmSyncStatus === 'loading'}
                  style={ebmSyncStatus === 'done' ? { color: 'var(--ok)', borderColor: '#bbf7d0' } : {}}
                >
                  {ebmSyncStatus === 'loading' ? (
                    <><svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg> Syncing…</>
                  ) : ebmSyncStatus === 'done' ? (
                    <>✓ {ebmSyncCount > 0 ? `${ebmSyncCount} synced` : 'Up to date'}</>
                  ) : (
                    <><IcoRefresh /> Sync EBM</>
                  )}
                </button>
                <button className="btn btn--primary" onClick={openAdd}>
                  <IcoPlus /> Add Item
                </button>
              </>
            )}
            {(pageTab === 'Add' || pageTab === 'Detail') && (
              <button className="btn" onClick={backToList}>
                <IcoBack /> Back to catalog
              </button>
            )}
          </div>
        </div>

        {/* ── Stats strip (List only, compact) ── */}
        {pageTab === 'List' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total Items',    value: total,    sub: 'in catalog',                      color: '' },
              { label: 'Active',         value: active,   sub: `${total-active} inactive`,         color: 'var(--ok)' },
              { label: 'VAT-B Taxable',  value: vatB,     sub: `${total>0?Math.round(vatB/total*100):0}% of catalog`, color: '' },
              { label: 'Services',       value: services, sub: 'no stock check',                  color: '' },
            ].map(s => (
              <div key={s.label} className="kpi" style={{ padding: '10px 16px' }}>
                <div className="kpi__label">{s.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: s.color || 'var(--ink-900)' }}>{s.value}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{s.sub}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            LIST TAB
        ═══════════════════════════════════════════════════ */}
        {pageTab === 'List' && (
          <div className="card">

            {/* ── Filter bar ── */}
            <div className="filterbar">
              {/* Search */}
              <div className="field" style={{ flex: 1 }}>
                <IcoSearch />
                <input
                  placeholder="Search by name, item code, barcode…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
                />
                {searchInput && searchInput !== search && (
                  <button className="btn btn--sm btn--primary" style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                    onClick={() => setSearch(searchInput)}>Go</button>
                )}
                {search && (
                  <button className="btn btn--sm" style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                    onClick={() => { setSearch(''); setSearchInput('') }}>✕ Clear</button>
                )}
              </div>
              {/* Tax filter */}
              <div className="field">
                <select value={taxFilter} onChange={e => setTaxFilter(e.target.value)} style={{ minWidth: 100 }}>
                  <option value="">All Tax</option>
                  <option value="A">A · Exempt</option>
                  <option value="B">B · 18%</option>
                  <option value="C">C · Zero</option>
                  <option value="D">D · Non-VAT</option>
                </select>
              </div>
              {/* Origin filter */}
              <div className="field">
                <select value={originFilter} onChange={e => setOriginFilter(e.target.value)} style={{ minWidth: 90 }}>
                  <option value="">All Origins</option>
                  {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Status filter (dropdown instead of tab bar) */}
              <div className="field">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 110 }}>
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Services">Services only</option>
                </select>
              </div>
              {/* View toggle */}
              <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
                {[['table', <IcoTable />], ['list', <IcoList />], ['grid', <IcoGrid />]].map(([mode, icon]) => (
                  <button key={mode}
                    className="icon-btn"
                    style={{
                      background: viewMode === mode ? 'var(--brand-100)' : '',
                      color: viewMode === mode ? 'var(--brand-700)' : '',
                      border: viewMode === mode ? '1px solid var(--brand-200,#c7d2fe)' : '',
                    }}
                    title={`${mode} view`}
                    onClick={() => setViewMode(mode)}
                  >{icon}</button>
                ))}
              </div>
            </div>

            {/* ── Error / Loading states ── */}
            {error && (
              <div className="settings-error" style={{ margin: '12px 16px' }}>{error}</div>
            )}
            {loading && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)' }}>Loading items…</div>
            )}

            {/* ── TABLE view ── */}
            {!loading && viewMode === 'table' && (
              <div className="table-wrap">
                {filtered.length === 0 ? (
                  <EmptyState search={search} onAdd={openAdd} />
                ) : (
                  <table className="data">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}><input type="checkbox" /></th>
                        <th>Item</th>
                        <th>Item code</th>
                        <th>Classification</th>
                        <th>Tax</th>
                        <th className="num">Price (RWF)</th>
                        <th>Status</th>
                        <th style={{ width: 40 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item, idx) => {
                        const initials = (item.name || item.code || '??').slice(0, 2).toUpperCase()
                        const { bg, color } = avatarColor(item.code || String(idx))
                        return (
                          <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(item)}>
                            <td onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 7, background: bg, color, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                                  {initials}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                                    {item.typeCode === '4' && <span style={{ fontSize: 10, background: '#ede9fe', color: '#6d28d9', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>Bundle</span>}
                                  </div>
                                  {item.barcode && <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>BCD {item.barcode}</div>}
                                </div>
                              </div>
                            </td>
                            <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item.code || '—'}</span></td>
                            <td><span style={{ fontSize: 12, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{item.classificationCode || '—'}</span></td>
                            <td><span className={`tax-chip ${TAX_COLORS[item.taxTypeCode] || ''}`}>{TAX_LABEL[item.taxTypeCode] || item.taxTypeCode}</span></td>
                            <td className="num" onClick={e => e.stopPropagation()}>
                              {editItem?.id === item.id ? (
                                <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'flex-end' }}>
                                  <input className="form-input form-input--sm input--mono" style={{ width: 90, textAlign: 'right' }}
                                    type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} autoFocus />
                                  <button className="btn btn--sm btn--primary" disabled={editSaving} onClick={() => handleUpdatePrice(item)}>{editSaving ? '…' : '✓'}</button>
                                  <button className="btn btn--sm" onClick={() => setEditItem(null)}>✕</button>
                                </div>
                              ) : (
                                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                  {Number(item.defaultUnitPrice || 0).toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td>
                              {item.useYn === 'Y'
                                ? <span className="chip chip--ok">Active</span>
                                : <span className="chip chip--err">Inactive</span>}
                            </td>
                            <td className="cell-actions" style={{ position: 'relative', width: 40 }} onClick={e => e.stopPropagation()}>
                              <ItemMenu
                                open={menuOpen === item.id}
                                onToggle={e => { e.stopPropagation(); setMenuOpen(menuOpen === item.id ? null : item.id) }}
                                onViewDetail={() => { openDetail(item); setMenuOpen(null) }}
                                onEditPrice={() => { setEditItem(item); setEditPrice(item.defaultUnitPrice || ''); setMenuOpen(null) }}
                                onToggleActive={() => { handleToggleActive(item); setMenuOpen(null) }}
                                onComposition={() => { setCompositionItem(item); setMenuOpen(null) }}
                                onDelete={() => { handleDelete(item); setMenuOpen(null) }}
                                isActive={item.useYn === 'Y'}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── LIST view ── */}
            {!loading && viewMode === 'list' && (
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.length === 0
                  ? <EmptyState search={search} onAdd={openAdd} />
                  : filtered.map((item, idx) => {
                    const initials = (item.name || item.code || '??').slice(0, 2).toUpperCase()
                    const { bg, color } = avatarColor(item.code || String(idx))
                    return (
                      <div key={item.id} onClick={() => openDetail(item)}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--ink-200)', background: 'var(--surface)', cursor: 'pointer', transition: 'border-color .15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-300,#93c5fd)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--ink-200)'}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: 9, background: bg, color, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{item.code}</div>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{item.classificationCode || '—'}</div>
                        <span className={`tax-chip ${TAX_COLORS[item.taxTypeCode] || ''}`}>{TAX_LABEL[item.taxTypeCode] || item.taxTypeCode}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 13.5, minWidth: 80, textAlign: 'right' }}>
                          {Number(item.defaultUnitPrice || 0).toLocaleString()} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-500)' }}>RWF</span>
                        </span>
                        {item.useYn === 'Y'
                          ? <span className="chip chip--ok">Active</span>
                          : <span className="chip chip--err">Inactive</span>}
                        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <ItemMenu
                            open={menuOpen === item.id}
                            onToggle={e => { e.stopPropagation(); setMenuOpen(menuOpen === item.id ? null : item.id) }}
                            onViewDetail={() => { openDetail(item); setMenuOpen(null) }}
                            onEditPrice={() => { setEditItem(item); setEditPrice(item.defaultUnitPrice || ''); setMenuOpen(null) }}
                            onToggleActive={() => { handleToggleActive(item); setMenuOpen(null) }}
                            onComposition={() => { setCompositionItem(item); setMenuOpen(null) }}
                            onDelete={() => { handleDelete(item); setMenuOpen(null) }}
                            isActive={item.useYn === 'Y'}
                          />
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            )}

            {/* ── GRID view ── */}
            {!loading && viewMode === 'grid' && (
              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {filtered.length === 0
                  ? <div style={{ gridColumn: '1/-1' }}><EmptyState search={search} onAdd={openAdd} /></div>
                  : filtered.map((item, idx) => {
                    const initials = (item.name || item.code || '??').slice(0, 2).toUpperCase()
                    const { bg, color } = avatarColor(item.code || String(idx))
                    return (
                      <div key={item.id} onClick={() => openDetail(item)}
                        style={{ padding: '16px 14px', borderRadius: 12, border: '1px solid var(--ink-200)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-300,#93c5fd)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--ink-200)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, color, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>{initials}</div>
                          {item.useYn === 'Y'
                            ? <span className="chip chip--ok" style={{ fontSize: 11 }}>Active</span>
                            : <span className="chip chip--err" style={{ fontSize: 11 }}>Inactive</span>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{item.code}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--ink-100)' }}>
                          <span className={`tax-chip ${TAX_COLORS[item.taxTypeCode] || ''}`}>{TAX_LABEL[item.taxTypeCode] || item.taxTypeCode}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14 }}>
                            {Number(item.defaultUnitPrice || 0).toLocaleString()}
                          </span>
                        </div>
                        <button className="btn btn--sm btn--ghost" style={{ width: '100%' }}
                          onClick={e => { e.stopPropagation(); openDetail(item) }}>
                          <IcoEye /> View details
                        </button>
                      </div>
                    )
                  })
                }
              </div>
            )}

            {/* ── Pagination ── */}
            {!loading && totalPages > 0 && (
              <div className="pagination">
                <span>
                  {total === 0 ? 'No items' :
                    `Showing ${((currentPage-1)*PER_PAGE)+1}–${Math.min(currentPage*PER_PAGE, total)} of ${total} items`}
                  {search && <span style={{ marginLeft: 8, color: 'var(--brand-600)', fontSize: 12, fontWeight: 600 }}>"{search}"</span>}
                </span>
                <div className="pages">
                  <button disabled={currentPage <= 1} onClick={() => load(currentPage - 1)}>‹</button>
                  {getPageNums(currentPage, totalPages).map((p, i) =>
                    typeof p === 'number'
                      ? <button key={i} className={p === currentPage ? 'is-active' : ''} onClick={() => load(p)}>{p}</button>
                      : <button key={i} disabled style={{ border: 'none', background: 'none', opacity: .5 }}>{p}</button>
                  )}
                  <button disabled={currentPage >= totalPages} onClick={() => load(currentPage + 1)}>›</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            ADD ITEM FORM (full width, no stats)
        ═══════════════════════════════════════════════════ */}
        {pageTab === 'Add' && (
          <div className="card">
            <div className="card__head">
              <div>
                <h3 style={{ margin: 0 }}>Register new item</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>
                  All required fields (<span style={{ color: 'var(--err)' }}>*</span>) must be filled before pushing to RRA
                </p>
              </div>
              {saveOk && <span className="chip chip--ok">Saved ✓</span>}
            </div>
            <form onSubmit={handleCreate}>
              <div className="card__body">
                {saveErr && <div className="settings-error" style={{ marginBottom: 16 }}>{saveErr}</div>}

                {/* Two-column main grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 24px' }}>

                  {/* Row 1: Item name | Item type | Classification */}
                  <div className="form-group">
                    <label className="form-label">Item name <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input className="form-input" required placeholder="e.g. Coca-Cola 50cl PET"
                      value={form.name} onChange={e => setF('name', e.target.value)} />
                    <span className="form-hint">Used on receipts · up to 200 characters</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Item type <span style={{ color: 'var(--err)' }}>*</span></label>
                    <select className="form-input" value={form.typeCode} onChange={e => {
                      const typeCode = e.target.value
                      if (typeCode === '3') {
                        // Service — non-stock, EBM still requires these fields, so
                        // send its "not applicable" values instead of asking the user.
                        setForm(f => ({ ...f, typeCode, packagingUnitCode: 'NT', quantityUnitCode: 'U', saftyQuantity: '' }))
                      } else {
                        setF('typeCode', typeCode)
                      }
                    }}>
                      {TYPE_CODES.map(t => <option key={t.v} value={t.v}>{t.v} · {t.l}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Classification <span style={{ color: 'var(--err)' }}>*</span></label>
                    <ClassificationPicker required value={form.classificationCode}
                      onChange={v => setF('classificationCode', v)}
                      onSelect={obj => {
                        if (!form.name) setF('name', obj.name || obj.itemClsNm)
                        const tax = obj.taxType || obj.taxTyCd
                        if (tax) setF('taxTypeCode', tax)
                      }}
                    />
                    <span className="form-hint">Type name or code — pick from dropdown</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tax type <span style={{ color: 'var(--err)' }}>*</span></label>
                    <select className="form-input" value={form.taxTypeCode} onChange={e => setF('taxTypeCode', e.target.value)}>
                      {taxOpts.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Origin country</label>
                    <select className="form-input" value={form.originalNationCode} onChange={e => setF('originalNationCode', e.target.value)}>
                      {countryOpts.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unit price (RWF) <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input className="form-input" type="number" required placeholder="e.g. 800"
                      value={form.defaultUnitPrice} onChange={e => setF('defaultUnitPrice', e.target.value)} />
                  </div>

                  {form.typeCode !== '3' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Packaging unit</label>
                        <select className="form-input" value={form.packagingUnitCode} onChange={e => setF('packagingUnitCode', e.target.value)}>
                          {pkgOpts.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Quantity unit</label>
                        <select className="form-input" value={form.quantityUnitCode} onChange={e => setF('quantityUnitCode', e.target.value)}>
                          {qtyOpts.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Barcode with auto-generate */}
                  <div className="form-group">
                    <label className="form-label">Barcode</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="form-input input--mono" placeholder="8-digit barcode"
                        value={form.barcode} onChange={e => setF('barcode', e.target.value)} style={{ flex: 1 }} />
                      <button type="button" className="btn btn--sm" title="Auto-generate barcode"
                        onClick={() => setF('barcode', generateBarcode())}
                        style={{ flexShrink: 0, gap: 5 }}>
                        <IcoMagic /> Gen
                      </button>
                    </div>
                    <span className="form-hint">Leave empty if no barcode</span>
                  </div>

                  {/* Batch number with auto-generate */}
                  <div className="form-group">
                    <label className="form-label">Batch number</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="form-input input--mono" placeholder="e.g. 25050301" maxLength={10}
                        value={form.batchNo} onChange={e => setF('batchNo', e.target.value)} style={{ flex: 1 }} />
                      <button type="button" className="btn btn--sm" title="Auto-generate batch number"
                        onClick={() => setF('batchNo', generateBatchNo())}
                        style={{ flexShrink: 0, gap: 5 }}>
                        <IcoMagic /> Gen
                      </button>
                    </div>
                    <span className="form-hint">Manufacturer batch tracking</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">CIS Product ID <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input className="form-input input--mono" required placeholder="e.g. 5020230101"
                      value={form.cisProductId} onChange={e => setF('cisProductId', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Insurance applicable</label>
                    <select className="form-input" value={form.insuranceApplicableYn} onChange={e => setF('insuranceApplicableYn', e.target.value)}>
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-input" value={form.useYn} onChange={e => setF('useYn', e.target.value)}>
                      <option value="Y">Active</option>
                      <option value="N">Inactive</option>
                    </select>
                  </div>

                  {form.typeCode !== '3' && (
                    <div className="form-group">
                      <label className="form-label">Safety quantity</label>
                      <input className="form-input input--mono" type="number" min="0" placeholder="—"
                        value={form.saftyQuantity} onChange={e => setF('saftyQuantity', e.target.value)} />
                      <span className="form-hint">Low-stock threshold sent to RRA</span>
                    </div>
                  )}

                  {/* Group prices — spans all 3 cols */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Group prices L1–L5 <span style={{ color: 'var(--ink-400)', fontWeight: 400 }}>(optional)</span></label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                      {[['groupPriceOne','L1 Retail'],['groupPriceTwo','L2'],['groupPriceThree','L3'],['groupPriceFour','L4'],['groupPriceFive','L5 Distrib']].map(([k, lbl]) => (
                        <div key={k}>
                          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 4 }}>{lbl}</div>
                          <input className="form-input input--mono" type="number" placeholder="—"
                            value={form[k]} onChange={e => setF(k, e.target.value)} />
                        </div>
                      ))}
                    </div>
                    <span className="form-hint">Tiered pricing for retail / wholesale / distributor</span>
                  </div>

                </div>

                {/* EBM code parameters (collapsed) */}
                <details style={{ marginTop: 8, marginBottom: 14 }}>
                  <summary style={{ fontSize: 12.5, color: 'var(--ink-500)', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
                    EBM item code parameters
                  </summary>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 20px', marginTop: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Country code</label>
                      <select className="form-input form-input--sm" value={form.countryCode} onChange={e => setF('countryCode', e.target.value)}>
                        {countryOpts.map(c => <option key={c.v} value={c.v}>{c.v}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Product type</label>
                      <select className="form-input form-input--sm" value={form.productType} onChange={e => setF('productType', e.target.value)}>
                        {productOpts.map(t => <option key={t.v} value={t.v}>{t.v}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Packing unit</label>
                      <select className="form-input form-input--sm" value={form.packingUnit} onChange={e => setF('packingUnit', e.target.value)}>
                        {pkgOpts.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Qty unit (code)</label>
                      <select className="form-input form-input--sm" value={form.quantityUnit} onChange={e => setF('quantityUnit', e.target.value)}>
                        {qtyOpts.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
                      </select>
                    </div>
                  </div>
                </details>

                {/* Live preview */}
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', fontSize: 12.5, color: 'var(--ink-700)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>API payload preview</div>
                  {[
                    ['Endpoint',   'POST /items/saveItems'],
                    ['itemNm',     form.name || '—'],
                    ['taxTyCd',    form.taxTypeCode || '—'],
                    ['dftPrc',     form.defaultUnitPrice || '—'],
                    ['itemClsCd',  form.classificationCode || '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--ink-100)' }}>
                      <span style={{ color: 'var(--ink-500)' }}>{k}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-800)', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--ink-200)', display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {saving ? 'Saving…' : 'Save & push to RRA'}
                </button>
                <button type="button" className="btn" onClick={() => { setForm(EMPTY_FORM); setSaveErr(null) }}>Clear form</button>
              </div>
            </form>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            DETAIL VIEW
        ═══════════════════════════════════════════════════ */}
        {pageTab === 'Detail' && detailItem && (
          <ItemDetailView
            item={detailItem}
            editItem={editItem}
            editPrice={editPrice}
            editSaving={editSaving}
            setEditPrice={setEditPrice}
            onOpenEditPrice={() => { setEditItem(detailItem); setEditPrice(detailItem.defaultUnitPrice || '') }}
            onSavePrice={() => handleUpdatePrice(detailItem)}
            onCancelEdit={() => setEditItem(null)}
            onToggleActive={() => handleToggleActive(detailItem)}
            onComposition={() => setCompositionItem(detailItem)}
            onDelete={() => handleDelete(detailItem)}
            typeLabel={TYPE_CODES.find(t => t.v === detailItem.typeCode)?.l || detailItem.typeCode}
          />
        )}

        {/* ── Composition modal ── */}
        {compositionItem && (
          <ItemCompositionModal
            item={compositionItem}
            onClose={() => setCompositionItem(null)}
            onSaved={() => load(currentPage)}
          />
        )}
      </div>
    </AppShell>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function EmptyState({ search, onAdd }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-500)' }}>
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink-700)', marginBottom: 6 }}>
        {search ? `No items matching "${search}"` : 'No items found'}
      </div>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        {search ? 'Try a different search term — search checks name, item code, and barcode.' : 'Add your first item to get started.'}
      </div>
      {!search && (
        <button className="btn btn--primary btn--sm" onClick={onAdd}>Add Item</button>
      )}
    </div>
  )
}

function ItemMenu({ open, onToggle, onViewDetail, onEditPrice, onToggleActive, onComposition, onDelete, isActive }) {
  return (
    <>
      <button className="btn btn--sm btn--ghost" onClick={onToggle}>⋯</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 9, padding: '4px 0', zIndex: 20, minWidth: 154, boxShadow: '0 6px 20px rgba(0,0,0,.13)' }}
          onClick={e => e.stopPropagation()}>
          <Mitem onClick={onViewDetail}>View details</Mitem>
          <Mitem onClick={onEditPrice}>Edit price</Mitem>
          <Mitem onClick={onToggleActive}>{isActive ? 'Deactivate' : 'Activate'}</Mitem>
          <Mitem onClick={onComposition}>Composition</Mitem>
          <div style={{ height: 1, background: 'var(--ink-100)', margin: '4px 0' }} />
          <Mitem onClick={onDelete} danger>Delete</Mitem>
        </div>
      )}
    </>
  )
}

function Mitem({ children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', padding: '7px 14px',
      textAlign: 'left', background: 'none', border: 'none',
      fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
      color: danger ? 'var(--err)' : 'inherit',
    }}>
      {children}
    </button>
  )
}
