import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "@/components/site/Navbar";
import { Footer, WhatsAppFloat } from "@/components/site/CtaFooter";
import { TalaWidget } from "@/components/tala/TalaWidget";
import { useCms } from "@/context/CmsContext";

export default function PublicLayout() {
  const location = useLocation();
  const { data } = useCms();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    document.title = data.settings.seo.homeTitle || data.settings.seo.siteTitle;
    const meta =
      document.querySelector('meta[name="description"]') || document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", data.settings.seo.homeDescription);
    if (!meta.parentElement) document.head.appendChild(meta);
  }, [data.settings.seo]);

  return (
    <div className="min-h-screen bg-[#FAF6EF] font-sans text-[#26221C] antialiased">
      <Navbar />
      <Outlet />
      <Footer />
      <WhatsAppFloat />
      <TalaWidget />
    </div>
  );
}
