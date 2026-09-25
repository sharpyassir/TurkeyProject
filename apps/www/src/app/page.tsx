import { Agents, Compare, Cta, Footer, Header, Hero, Marketplace, Pricing, Products, TrustStrip } from '@/components/marketing';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <Products />
        <Agents />
        <Pricing />
        <Marketplace />
        <Compare />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
