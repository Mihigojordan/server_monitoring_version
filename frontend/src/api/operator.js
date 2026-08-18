import { api } from './client'

export const operatorApi = {
  // ── Items (/stocks/item/...) ─────────────────────────────────────────────
  listItems:   (page = 1, perPage = 5)  => api.get(`/stocks/item/list?page=${page}&perPage=${perPage}`),
  searchItems: (q, page = 1, perPage = 5) => api.get(`/stocks/item/search?q=${encodeURIComponent(q)}&page=${page}&perPage=${perPage}`),
  findItem:    (id)                     => api.get(`/stocks/item/find/${id}`),
  createItem:  (data)                   => api.post('/stocks/item/save', data),
  syncItemsFromEbm: ()                  => api.post('/stocks/item/sync', {}),
  updateItem:  (items)                  => api.put('/stocks/item/update', { items }),
  deleteItem:  (code)                   => api.del(`/stocks/item/${code}`),
  getItemCompositions: (code)           => api.get(`/stocks/item/${encodeURIComponent(code)}/compositions`),
  saveItemComposition: (data)           => api.post('/stocks/item/composition/save', data),

  // ── Stock movements (/stocks/...) ────────────────────────────────────────
  listStockMasters:   (page = 1, perPage = 50) => api.get(`/stocks/master/list?page=${page}&perPage=${perPage}`),
  listStocks:         (page = 1, perPage = 10) => api.get(`/stocks/list?page=${page}&perPage=${perPage}`),
  saveStock:          (data) => api.post('/stocks/save', data),
  saveStockWithItems: (data) => api.post('/stocks/save_with_items', data),
  saveMaster:         (data) => api.post('/stocks/master/save', data), // data.stockTyCd: '1'=Opening, '3'=Adjustment
  syncStock:          ()     => api.get('/stocks/sync'),
  transferStock:      (data) => api.post('/stocks/transfer', data),

  // ── Cash (/cash/...) ─────────────────────────────────────────────────────
  deposit:    (data)       => api.post('/cash/deposit', data),
  withdrawal: (data)       => api.post('/cash/withdrawal', data),
  voidCashMovement: (id, reason) => api.post('/cash/void', { id, reason }),
  closeCashDay: (date, countedAmount, note) => api.post('/cash/close-day', { date, countedAmount, note }),
  exportCash: (date = '')  => api.download(`/cash/export${date ? `?date=${date}` : ''}`),
  cashList:   (date = '')  => api.get(`/cash/list${date ? `?date=${date}` : ''}`),

  // ── Training mode (/transactions/training-mode/toggle) ───────────────────
  toggleTraining: () => api.post('/transactions/training-mode/toggle', {}),

  // ── Sales (/transactions/...) ────────────────────────────────────────────
  createSale:      (data)           => api.post('/transactions/sale', data),
  trainingSale:    (data)           => api.post('/transactions/training', data),
  refundSale:      (data)           => api.post('/transactions/refund', data),
  copySale:        (data)           => api.post('/transactions/copy', data),
  proformaSale:    (data)           => api.post('/transactions/proforma', data),
  listSales:       (page = 1, perPage = 12) => api.get(`/transactions/sale/list?page=${page}&perPage=${perPage}`),
  findSale:        (id)             => api.get(`/transactions/sale/find?id=${id}`),
  lockCheck:       (id)             => api.get(`/transactions/sale/${id}/lock-check`),
  lastReceipt:     ()               => api.get('/transactions/last-receipt'),
  receiptCounters: ()               => api.get('/transactions/counters'),
  dashboardSummary: ()               => api.get('/transactions/dashboard-summary'),
  ebmReconnect:    ()               => api.post('/transactions/ebm-reconnect', {}),

  // ── Purchases (/transactions/purchase/...) ───────────────────────────────
  listPurchases:  (page = 1, perPage = 10) => api.get(`/transactions/purchase/list?page=${page}&perPage=${perPage}`),
  createPurchase: (data) => api.post('/transactions/purchase/create', data),
  savePurchase:   (data) => api.post('/transactions/purchase/save', data),
  hidePurchase:   (purchaseId) => api.post('/transactions/purchase/hide', { purchaseId }),
  updatePurchaseRemark: (purchaseId, remark) => api.post('/transactions/purchase/remark', { purchaseId, remark }),

  // ── Import items (/transactions/items/import/...) ────────────────────────
  listImports:    (page = 1, perPage = 10) => api.get(`/transactions/items/import/list?page=${page}&perPage=${perPage}`),
  selectImport:   (branchId) => api.get(`/transactions/items/import/select/${branchId}`),
  approveImport:  (data) => api.post('/transactions/items/import/approve', data),
  cancelImport:   (data) => api.post('/transactions/items/import/cancel', data),

  // ── Receipts ─────────────────────────────────────────────────────────────
  receiptById: (id) => api.get(`/receipt/${id}`),

  // ── Branch transactions (/transactions/:branchId) ────────────────────────
  branchTransactions: (branchId) => api.get(`/transactions/${branchId}`),

  // ── Reports (/report/...) ────────────────────────────────────────────────
  dailyReport:    (date)        => api.get(`/report/daily?date=${date}`),
  periodReport:   (start, end)    => api.get(`/report/period?start=${start}&end=${end}`),
  xReport:        ()              => api.get('/report/x'),
  pluReport:      (start, end)    => api.get(`/report/plu?start=${start}&end=${end}`),
  ejReport:       (start, end, page = 1) => api.get(`/report/ej?start=${start}&end=${end}&page=${page}&limit=50`),
  stockReport:        (start, end) => api.get(`/report/stock?start=${start}&end=${end}`),
  closingStockReport: (date)       => api.get(`/report/closing-stock?date=${date}`),
  purchasesReport:(start, end)    => api.get(`/report/purchases?start=${start}&end=${end}`),

  // ── Branches (/branches/...) ─────────────────────────────────────────────
  listBranches:   ()     => api.get('/branches/'),
  findBranch:     ()     => api.get('/branches/find'),
  selectBranches: (branchId, lastRequestDt = '') => api.get(`/branches/selectBranches/${branchId}${lastRequestDt ? `?dt=${lastRequestDt}` : ''}`),
  selectBranchesPost: (branchId, lastRequestDt = '') => api.post(`/branches/selectBranches/${branchId}`, { lastRequestDt }),
  saveCustomer:   (data) => api.post('/branches/customers/save', data),
  updateCustomer: (data) => api.put('/branches/customers/update', data),
  deleteCustomer: (id)   => api.del(`/branches/customers/${id}`),
  listCustomers:  (page = 1, perPage = 20) => api.get(`/branches/customers/list?page=${page}&perPage=${perPage}`),
  searchCustomers:(q, page = 1, perPage = 20) => api.get(`/branches/customers/search?q=${encodeURIComponent(q)}&page=${page}&perPage=${perPage}`),
  syncCustomers:  (data) => api.post('/branches/customers/sync', data),
  customerSyncStatus: () => api.get('/branches/customers/sync-status'),
  customerStats: () => api.get('/branches/customers/stats'),
  customerSalesHistory: (id, page = 1, perPage = 5) => api.get(`/branches/customers/${id}/sales?page=${page}&perPage=${perPage}`),
  exportCustomers: () => api.download('/branches/customers/export'),
  importCustomers: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.upload('/branches/customers/import', form)
  },
  saveInsurance:  (data) => api.post('/branches/insurances/save', data),
  listInsurances: (page = 1, perPage = 20) => api.get(`/branches/insurances/list?page=${page}&perPage=${perPage}`),
  saveBranchUser: (data) => api.post('/branches/users/save', data),
  updateBranchUser:(data) => api.put('/branches/users/update', data),
  deleteBranchUser:(id)   => api.del(`/branches/users/${id}`),
  listBranchUsers:(page = 1, perPage = 20) => api.get(`/branches/users/list?page=${page}&perPage=${perPage}`),

  // ── Reference data (/customers/:branchId, /items/classification/:branchId) ─
  selectCustomer:           (branchId, customerTin) => api.get(`/customers/selectCustomer/${branchId}?customerTin=${encodeURIComponent(customerTin)}`),
  selectCustomerPost:       (branchId, customerTin) => api.post(`/customers/selectCustomer/${branchId}`, { customerTin }),
  itemClassification:       (branchId) => api.get(`/items/classification/${branchId}`),
  syncClassificationCodes:  ()          => api.get('/item/classification/sync'),
  selectItemsClass:         (branchId, lastRequestDt = '') => api.get(`/itemClass/${branchId}${lastRequestDt ? `?dt=${lastRequestDt}` : ''}`),
  searchClassificationCodes:(q = '', { page = 1, perPage = 20, taxType = '' } = {}) => {
    const params = new URLSearchParams({ page, perPage })
    if (q)       params.set('name', q)
    if (taxType) params.set('taxType', taxType)
    return api.get(`/codes/item/classification/list?${params.toString()}`)
  },
  branchCodes:              (branchId) => api.get(`/codes/${branchId}`),
  purchaseCode:             (data)     => api.post('/purchasecode', data),

  // ── Notices (/notices/) ──────────────────────────────────────────────────
  notices: (page = 1, perPage = 10) => api.get(`/notices/?page=${page}&perPage=${perPage}`),

  // ── Config (/config/...) ──────────────────────────────────────────────────
  getExchangeRates: () => api.get('/config/exchange-rates'),

  // ── Notices (/notices/...) ──────────────────────────────────────────────────
  selectNotices: (branchId, lastRequestDt = '') => api.get(`/notices/selectNotices/${branchId}${lastRequestDt ? `?dt=${lastRequestDt}` : ''}`),
  selectNoticesPost: (branchId, lastRequestDt = '') => api.post(`/notices/selectNotices/${branchId}`, { lastRequestDt }),

  // ── Customers (/customers/...) ─────────────────────────────────────────────
  lookupCustomerByTin: (tin) => api.get(`/customers/lookup-by-tin?tin=${encodeURIComponent(tin)}`), // F-43: TIN lookup
}
