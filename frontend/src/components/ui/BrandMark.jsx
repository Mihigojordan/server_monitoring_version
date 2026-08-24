import logo from '../../assets/yb_group_logo.jpg'

/**
 * BrandMark — Unified Datacenter Management logo, wrapped in a white
 * badge so the JPEG's opaque background reads correctly on dark surfaces.
 *
 * Pass `size` for a fixed height (auto width) — used inline next to text.
 * Pass `fill` to instead stretch the badge to its container's full width
 * and size the image to `fillPct` of that width (auto height).
 */
export default function BrandMark({ size = 38, fill = false, fillPct = '80%' }) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        borderRadius: 8,
        padding: '4px 8px',
        boxShadow: '0 1px 3px rgba(0,0,0,.12)',
        flexShrink: 0,
        width: fill ? '100%' : undefined,
        boxSizing: 'border-box',
      }}
    >
      <img
        src={logo}
        alt="Unified Datacenter Management"
        style={
          fill
            ? { width: fillPct, height: 'auto', objectFit: 'contain', display: 'block' }
            : { height: size, width: 'auto', objectFit: 'contain', display: 'block' }
        }
      />
    </span>
  )
}
