import React from 'react'

/**
 * BrandMark — Uses the official yb_group_logo.png asset.
 */
export default function BrandMark({ size = 38 }) {
  return (
    <img 
      src="/yb_group_logo.png" 
      alt="YB Group Logo" 
      style={{ 
        width: size, 
        height: size, 
        objectFit: 'contain',
        display: 'inline-block', 
        verticalAlign: 'middle' 
      }} 
    />
  )
}
