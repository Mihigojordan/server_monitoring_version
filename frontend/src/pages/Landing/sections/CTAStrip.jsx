import { Link } from 'react-router-dom'

export default function CTAStrip() {
  return (
    <div className="cta-strip">
      <div>
        <h2>Get your server room under control before the next outage.</h2>
        <p>
          Connect your first devices, set thresholds and we&apos;ll walk you through onboarding,
          alert routing and your first predictive maintenance report — usually under 30 minutes.
        </p>
      </div>
      <div className="btns">
        <Link className="btn btn--white btn--lg" to="/dashboard">Open dashboard</Link>
        <a className="btn btn--outline-w btn--lg" href="#docs">Read the docs</a>
      </div>
    </div>
  )
}
