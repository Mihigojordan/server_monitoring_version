export {
  STATUSES, statusMeta,
  ISSUE_SEVERITIES, issueSeverityMeta,
  ISSUE_STATUSES, issueStatusMeta,
  PERIODS, pct, fmtDate, fmtDateTime, timeAgo,
} from '../../lib/infraShared'
import { genId } from '../../lib/infraShared'

export const DEVICE_TYPES = ['Blade Switch', 'Switch', 'Router', 'Firewall', 'Access Point', 'Load Balancer']

export const PORT_STATUSES = ['Up', 'Down', 'Disabled']
export const PORT_STATUS_META = {
  Up:       { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  Down:     { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
  Disabled: { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
}
export const portStatusMeta = s => PORT_STATUS_META[s] || PORT_STATUS_META.Down

export const EMPTY_DEVICE_FORM = {
  name: '', deviceId: '', status: 'Online', type: 'Blade Switch',
  manufacturer: '', model: '', serialNumber: '',
  ip: '', managementVlan: '',
  portCount: '', uplinkSpeed: '', poeSupported: false,
  firmwareVersion: '', location: '', notes: '',
}

export function genDeviceId() {
  return genId('NET')
}
