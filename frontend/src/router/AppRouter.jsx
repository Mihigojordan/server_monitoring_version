import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '../components/layout/ProtectedRoute'
import Landing        from '../pages/Landing/Landing'
import About          from '../pages/About/About'
import Contact        from '../pages/Contact/Contact'
import Login          from '../pages/Login/Login'
import AdminDashboard   from '../pages/Admin/AdminDashboard'
import AdminUsers       from '../pages/Admin/AdminUsers'
import AdminBranches    from '../pages/Admin/AdminBranches'
import AdminTaxConfig   from '../pages/Admin/AdminTaxConfig'
import AdminTools       from '../pages/Admin/AdminTools'
import AdminActivityLog from '../pages/Admin/AdminActivityLog'
import AdminSettings    from '../pages/Admin/AdminSettings'
import AdminProfile     from '../pages/Admin/AdminProfile'
import Dashboard   from '../pages/Dashboard/Dashboard'
import Items       from '../pages/Items/Items'
import HsCodes     from '../pages/Items/HsCodes'
import Invoice     from '../pages/Invoice/Invoice'
import NewInvoice  from '../pages/Invoice/NewInvoice'
import Purchases   from '../pages/Purchases/Purchases'
import Imports     from '../pages/Imports/Imports'
import Stock       from '../pages/Stock/Stock'
import StockBatch    from '../pages/Stock/StockBatch'
import StockMaster   from '../pages/Stock/StockMaster'
import InventoryList from '../pages/Stock/InventoryList'
import CashManagement from '../pages/Stock/CashManagement'
import Settings    from '../pages/Settings/Settings'
import Activity    from '../pages/Activity/Activity'
import Customers    from '../pages/Customers/Customers'
import Insurances   from '../pages/Insurances/Insurances'
import BranchUsers  from '../pages/BranchUsers/BranchUsers'
import XReport from '../pages/Reports/XReport'
import DailyReport from '../pages/Reports/DailyReport'
import PeriodReport from '../pages/Reports/PeriodReport'
import PluReport from '../pages/Reports/PluReport'
import EjReport from '../pages/Reports/EjReport'
import StockReport from '../pages/Reports/StockReport'
import PurchasesReport from '../pages/Reports/PurchasesReport'
import Notices      from '../pages/Notices/Notices'
import ReferenceCodes from '../pages/ReferenceCodes/ReferenceCodes'
import AlertsCenter from '../pages/Alerts/AlertsCenter'
import ResourceManagement from '../pages/Resources/ResourceManagement'
import ServerManagement from '../pages/ServerManagement/ServerManagement'
import ServerDetail from '../pages/ServerManagement/ServerDetail'
import StorageManagement from '../pages/StorageManagement/StorageManagement'
import StorageDetail from '../pages/StorageManagement/StorageDetail'
import NetworkManagement from '../pages/NetworkManagement/NetworkManagement'
import NetworkDeviceDetail from '../pages/NetworkManagement/NetworkDeviceDetail'
import UserManagement from '../pages/UserManagement/UserManagement'
import LogManagement from '../pages/LogManagement/LogManagement'
import SystemConfiguration from '../pages/SystemConfiguration/SystemConfiguration'
import HelpCenter from '../pages/HelpCenter/HelpCenter'
import SupportTickets from '../pages/SupportTickets/SupportTickets'
import SupportUtilization from '../pages/SupportUtilization/SupportUtilization'
import EquipmentLifecycle from '../pages/EquipmentLifecycle/EquipmentLifecycle'
import PredictiveMaintenance from '../pages/PredictiveMaintenance/PredictiveMaintenance'
import ServerAnalytics from '../pages/PredictiveAnalytics/ServerAnalytics'
import StorageAnalytics from '../pages/PredictiveAnalytics/StorageAnalytics'
import SwitchAnalytics from '../pages/PredictiveAnalytics/SwitchAnalytics'
import ResourceUtilization from '../pages/ResourceUtilization/ResourceUtilization'
import SystemOverview from '../pages/SystemOverview/SystemOverview'
import ReportManagement from '../pages/ReportManagement/ReportManagement'
import CostReporting from '../pages/CostReporting/CostReporting'
import ComplianceAudit from '../pages/ComplianceAudit/ComplianceAudit'

function AdminApp() {
  return (
    <ProtectedRoute adminOnly>
      <Routes>
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/branches"  element={<AdminBranches />} />
        <Route path="/users"     element={<AdminUsers />} />
        <Route path="/tax"       element={<AdminTaxConfig />} />
        <Route path="/tools"     element={<AdminTools />} />
        <Route path="/logs"      element={<AdminActivityLog />} />
        <Route path="/settings"  element={<AdminSettings />} />
        <Route path="/profile"   element={<AdminProfile />} />
        <Route path="*"          element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </ProtectedRoute>
  )
}

function OperatorApp() {
  return (
    <ProtectedRoute>
      <Routes>
        <Route path="/dashboard"  element={<Dashboard />} />
        <Route path="/system-overview" element={<SystemOverview />} />
        <Route path="/items"      element={<Items />} />
        <Route path="/items/hs-codes" element={<HsCodes />} />
        <Route path="/invoice"     element={<Invoice />} />
        <Route path="/invoice/new" element={<NewInvoice />} />
        <Route path="/purchases"  element={<Purchases />} />
        <Route path="/imports"    element={<Imports />} />
        <Route path="/stock"          element={<Stock />} />
        <Route path="/stock/batch"    element={<StockBatch />} />
        <Route path="/stock/count"    element={<StockMaster />} />
        <Route path="/stock/list"     element={<InventoryList />} />
        <Route path="/stock/cash"     element={<CashManagement />} />
        <Route path="/customers"  element={<Customers />} />
        <Route path="/insurances"   element={<Insurances />} />
        <Route path="/branch-users" element={<BranchUsers />} />
        <Route path="/settings"     element={<Settings />} />
        <Route path="/activity"   element={<Activity />} />
        <Route path="/reports/x"         element={<XReport />} />
        <Route path="/reports/daily"     element={<DailyReport />} />
        <Route path="/reports/period"    element={<PeriodReport />} />
        <Route path="/reports/plu"       element={<PluReport />} />
        <Route path="/reports/ej"        element={<EjReport />} />
        <Route path="/reports/stock"     element={<StockReport />} />
        <Route path="/reports/purchases" element={<PurchasesReport />} />
        <Route path="/reports"           element={<Navigate to="/reports/x" replace />} />
        <Route path="/report-management" element={<ReportManagement />} />
        <Route path="/notices"    element={<Notices />} />
        <Route path="/reference-codes" element={<ReferenceCodes />} />
        <Route path="/alerts"     element={<AlertsCenter />} />
        <Route path="/resources"  element={<ResourceManagement />} />
        <Route path="/server-management"     element={<ServerManagement />} />
        <Route path="/server-management/:id" element={<ServerDetail />} />
        <Route path="/storage-management"     element={<StorageManagement />} />
        <Route path="/storage-management/:id" element={<StorageDetail />} />
        <Route path="/network-management"     element={<NetworkManagement />} />
        <Route path="/network-management/:id" element={<NetworkDeviceDetail />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/logs"       element={<LogManagement />} />
        <Route path="/system-configuration" element={<SystemConfiguration />} />
        <Route path="/help-center" element={<HelpCenter />} />
        <Route path="/support-tickets" element={<SupportTickets />} />
        <Route path="/support-utilization" element={<SupportUtilization />} />
        <Route path="/equipment-lifecycle" element={<EquipmentLifecycle />} />
        <Route path="/predictive-maintenance" element={<PredictiveMaintenance />} />
        <Route path="/predictive-analytics" element={<Navigate to="/predictive-analytics/servers" replace />} />
        <Route path="/predictive-analytics/servers" element={<ServerAnalytics />} />
        <Route path="/predictive-analytics/storage" element={<StorageAnalytics />} />
        <Route path="/predictive-analytics/switches" element={<SwitchAnalytics />} />
        <Route path="/resource-utilization" element={<ResourceUtilization />} />
        <Route path="/cost-reporting" element={<CostReporting />} />
        <Route path="/compliance-audit" element={<ComplianceAudit />} />
        <Route path="*"           element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ProtectedRoute>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<Landing />} />
        <Route path="/about"   element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login"   element={<Login />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/*"       element={<OperatorApp />} />
      </Routes>
    </BrowserRouter>
  )
}
