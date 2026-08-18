const codeStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  background: 'var(--ink-100)',
  padding: '1px 5px',
  borderRadius: '4px',
}

export default function Workflow() {
  return (
    <section className="sec workflow" id="workflow">
      <div className="inner">
        <div className="sec__hd">
          <span className="eyebrow">From rack to report</span>
          <h2>Four steps, no surprises.</h2>
          <p>Once your devices are onboarded and thresholds are set, the rest is workflow — not another 3 a.m. page.</p>
        </div>

        <div className="flow-grid">
          <div className="step">
            <h4>Connect your devices</h4>
            <p>
              Onboard servers, storage arrays and network gear via SNMP or{' '}
              <code style={codeStyle}>/api/devices</code>{' '}
              in minutes — no agents to babysit, no downtime to schedule.
            </p>
          </div>
          <div className="step">
            <h4>Set thresholds &amp; rules</h4>
            <p>Configure warning and critical thresholds per resource — CPU, memory, disk, temperature, power — or start from ML-tuned defaults.</p>
          </div>
          <div className="step">
            <h4>Watch &amp; forecast</h4>
            <p>Live health across every rack, with predictive curves flagging capacity and failure risk before it becomes an outage.</p>
          </div>
          <div className="step">
            <h4>Act, report &amp; audit</h4>
            <p>Acknowledge alerts, schedule maintenance and export capacity, uptime and incident reports — every action logged for audit.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
