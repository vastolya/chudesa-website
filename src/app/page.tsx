import Experience from "@/components/Experience";
import Effects from "@/components/Effects";
import Header from "@/components/Header";
import Overlays from "@/components/Overlays";
import Hero from "@/components/sections/Hero";
import Services from "@/components/sections/Services";
import Factory from "@/components/sections/Factory";
import Process from "@/components/sections/Process";
import Cases from "@/components/sections/Cases";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <Experience />
      <div className="grain" aria-hidden />
      <Header />
      <main>
        <Hero />
        <Services />
        <Factory />
        <Process />
        <Cases />
        <Contact />
      </main>
      <Footer />
      <Overlays />
      <Effects />
    </>
  );
}
