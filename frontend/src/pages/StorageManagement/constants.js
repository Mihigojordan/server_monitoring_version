export {
  STATUSES, statusMeta,
  ISSUE_SEVERITIES, issueSeverityMeta,
  ISSUE_STATUSES, issueStatusMeta,
  BACKUP_STATUSES, backupStatusMeta,
  PERIODS, pct, fmtDate, fmtDateTime, timeAgo,
} from '../../lib/infraShared'
import { genId } from '../../lib/infraShared'

export const STORAGE_TYPES = ['SAN', 'NAS', 'Object Storage', 'Block Storage', 'Local Disk', 'Tape']

export const DISK_TYPES = ['HDD', 'SSD', 'NVMe SSD', 'Hybrid']

export const VOLUME_STATUSES = ['Attached', 'Detached', 'Degraded', 'Failed']
export const VOLUME_STATUS_META = {
  Attached: { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  Detached: { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
  Degraded: { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
  Failed:   { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
}
export const volumeStatusMeta = s => VOLUME_STATUS_META[s] || VOLUME_STATUS_META.Attached

export const SNAPSHOT_STATUSES = ['Completed', 'In Progress', 'Failed']
export const SNAPSHOT_STATUS_META = {
  Completed:   { bg: '#dcfce7', text: '#15803d' },
  'In Progress': { bg: '#e0f2fe', text: '#0369a1' },
  Failed:      { bg: '#fee2e2', text: '#b91c1c' },
}
export const snapshotStatusMeta = s => SNAPSHOT_STATUS_META[s] || SNAPSHOT_STATUS_META.Completed

export const EMPTY_STORAGE_FORM = {
  name: '', deviceId: '', status: 'Online', type: 'NAS',
  provider: '', location: '', ip: '',
  capacityTotalGb: '', capacityUsedGb: '', diskType: 'SSD', raidLevel: '', numDisks: '',
  iops: '', throughputMbps: '', latencyMs: '',
  attachedServers: '', notes: '',
}

export function genDeviceId() {
  return genId('STG')
}
