import { useScrollSpy } from './useScrollSpy'

const LANDING_SECTIONS = ['features', 'workflow', 'compliance', 'docs']

export function useActiveSection() {
  return useScrollSpy(LANDING_SECTIONS)
}
