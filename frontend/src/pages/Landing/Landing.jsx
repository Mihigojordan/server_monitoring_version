import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import Hero from './sections/Hero'
import Logos from './sections/Logos'
import Features from './sections/Features'
import Workflow from './sections/Workflow'
import Showcase from './sections/Showcase'
import Compliance from './sections/Compliance'
import CTAStrip from './sections/CTAStrip'

export default function Landing() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Logos />
        <Features />
        <Workflow />
        <Showcase />
        <Compliance />
        <CTAStrip />
      </main>
      <Footer />
    </>
  )
}
