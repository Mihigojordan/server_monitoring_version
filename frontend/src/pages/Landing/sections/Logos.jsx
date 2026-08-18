import { Fragment } from 'react'

const LOGOS = ['NATIONAL DATACENTER', 'CORE NETWORK NOC', 'KIGALI CLOUD HUB', 'REGIONAL BANK OPS', 'MINISTRY OF ICT']

export default function Logos() {
  return (
    <div className="logos">
      <div className="logos__title">Trusted by IT operations and NOC teams running mission-critical server rooms</div>
      <div className="logos__row">
        {LOGOS.map((name, i) => (
          <Fragment key={name}>
            <span>{name}</span>
            {i < LOGOS.length - 1 && <span>·</span>}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
