import React from 'react'

/**
 * RraLogo — Uses the official rra_logo_2.png asset.
 */
export default function RraLogo({ size = 80 }) {
  return (
    <img
      src="/image.png"
      alt="Rwanda Revenue Authority"
      style={{ width: size, height: 'auto', display: 'inline-block', verticalAlign: 'middle' }}
    />
  )
}
