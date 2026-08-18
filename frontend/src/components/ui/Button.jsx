import { Link } from 'react-router-dom'

export default function Button({ children, variant, size, to, href, className = '', ...props }) {
  const cls = [
    'btn',
    variant === 'primary' && 'btn--primary',
    variant === 'ghost' && 'btn--ghost',
    variant === 'danger' && 'btn--danger',
    variant === 'white' && 'btn--white',
    variant === 'outline-white' && 'btn--outline-w',
    size === 'sm' && 'btn--sm',
    size === 'lg' && 'btn--lg',
    className,
  ].filter(Boolean).join(' ')

  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>
  if (href) return <a href={href} className={cls} {...props}>{children}</a>
  return <button className={cls} {...props}>{children}</button>
}
