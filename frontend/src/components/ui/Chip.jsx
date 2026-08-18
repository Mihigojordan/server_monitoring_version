export default function Chip({ children, variant = 'default', style }) {
  const cls = ['chip', variant !== 'default' && `chip--${variant}`].filter(Boolean).join(' ')
  return <span className={cls} style={style}>{children}</span>
}
