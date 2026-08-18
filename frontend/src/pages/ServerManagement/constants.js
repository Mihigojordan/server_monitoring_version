export {
  STATUSES, statusMeta,
  ISSUE_SEVERITIES, issueSeverityMeta,
  ISSUE_STATUSES, issueStatusMeta,
  BACKUP_STATUSES, backupStatusMeta,
  PERIODS, pct, fmtDate, fmtDateTime, timeAgo,
} from '../../lib/infraShared'
import { genId } from '../../lib/infraShared'

export const SERVER_TYPES = ['VPS', 'Dedicated', 'Cloud', 'Physical', 'Virtual Machine']
export const ENVIRONMENTS = ['Production', 'Staging', 'Development', 'Testing']

export const ENV_META = {
  Production:  { bg: '#fee2e2', text: '#b91c1c' },
  Staging:     { bg: '#fef3c7', text: '#b45309' },
  Development: { bg: '#eef2ff', text: '#4338ca' },
  Testing:     { bg: '#f1f5f9', text: '#475569' },
}
export const envMeta = e => ENV_META[e] || ENV_META.Testing

export const SERVICE_STATUSES = ['Running', 'Stopped', 'Failed', 'Restarting']
export const SERVICE_STATUS_META = {
  Running:     { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  Stopped:     { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
  Failed:      { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
  Restarting:  { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
}
export const serviceStatusMeta = s => SERVICE_STATUS_META[s] || SERVICE_STATUS_META.Stopped

export const LOG_SEVERITIES = ['Debug', 'Info', 'Warning', 'Error', 'Critical']
export const LOG_SEVERITY_META = {
  Debug:    { bg: '#f1f5f9', text: '#475569' },
  Info:     { bg: '#e0f2fe', text: '#0369a1' },
  Warning:  { bg: '#fef3c7', text: '#b45309' },
  Error:    { bg: '#ffedd5', text: '#c2410c' },
  Critical: { bg: '#fee2e2', text: '#b91c1c' },
}
export const logSeverityMeta = s => LOG_SEVERITY_META[s] || LOG_SEVERITY_META.Info

export const LOG_SOURCES = ['System', 'Application', 'Error', 'Access', 'Security', 'Authentication', 'Service', 'Deployment']

export const DEPLOYMENT_STATUSES = ['Successful', 'Failed', 'Running', 'Rolled Back']
export const DEPLOYMENT_STATUS_META = {
  Successful:   { bg: '#dcfce7', text: '#15803d' },
  Failed:       { bg: '#fee2e2', text: '#b91c1c' },
  Running:      { bg: '#e0f2fe', text: '#0369a1' },
  'Rolled Back':{ bg: '#fef3c7', text: '#b45309' },
}
export const deploymentStatusMeta = s => DEPLOYMENT_STATUS_META[s] || DEPLOYMENT_STATUS_META.Running

export const EMPTY_SERVER_FORM = {
  name: '', serverId: '', status: 'Online', type: 'VPS',
  provider: '', location: '', ip: '', publicIp: '', privateIp: '',
  os: '', osVersion: '', hostname: '', domain: '', role: '', environment: 'Production',
  cpuModel: '', cpuCores: '', cpuThreads: '', cpuUsage: '', cpuUsageAvg: '', cpuUsagePeak: '',
  ramTotalGb: '', ramUsedGb: '',
  storageTotalGb: '', storageUsedGb: '', diskType: '', diskCount: '',
  netDownloadMbps: '', netUploadMbps: '', netBandwidthUsagePct: '', netInterface: '',
  netStatus: 'Up', packetsSent: '', packetsReceived: '',
  sshPort: '22', firewallStatus: 'Enabled', sslExpiry: '', uptimeDays: '',
  monitoringEnabled: true, backupEnabled: true, backupFrequency: 'Daily', backupRetentionDays: '30',
  notes: '',
}

export function genServerId() {
  return genId('SRV')
}
