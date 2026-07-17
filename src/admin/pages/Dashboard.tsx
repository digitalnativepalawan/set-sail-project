import { Link } from "react-router-dom";
import { Tags, Images, Newspaper, Quote, HelpCircle, ArrowUpRight, ExternalLink, CalendarCheck, Ship, Bike, CircleDollarSign } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { PageHeader } from "../shared/PageHeader";
import { formatPHP } from "../ops/opsUtils";

export default function Dashboard() {
  const { data } = useCms();

  const stats = [
    { label: "Pricing Packages", value: data.pricing.length, icon: Tags, to: "/admin/pricing" },
    { label: "Gallery Images", value: data.gallery.length, icon: Images, to: "/admin/gallery" },
    { label: "Blog Posts", value: data.blogPosts.length, icon: Newspaper, to: "/admin/blog" },
    { label: "Testimonials", value: data.testimonials.length, icon: Quote, to: "/admin/testimonials" },
    { label: "FAQs", value: data.faqs.length, icon: HelpCircle, to: "/admin/faqs" },
  ];

  const published = data.blogPosts.filter((p) => p.status === "published").length;
  const drafts = data.blogPosts.filter((p) => p.status === "draft").length;

  return (
    <div>
      <PageHeader
        title="Welcome back 👋"
        description="Your control center for the website and the day-to-day operations of Marina Terrace."
        actions={
          <>
            <Link to="/admin/operations" className="inline-flex items-center gap-1.5 rounded-full bg-[#C6A15B] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#221D14] hover:bg-[#B8924B]">
              <CalendarCheck className="h-3.5 w-3.5" /> Operations
            </Link>
            <Link to="/" target="_blank" className="inline-flex items-center gap-1.5 rounded-full bg-[#26221C] px-4 py-2 text-xs font-medium uppercase tracking-wide text-white hover:bg-[#3a3327]">
              <ExternalLink className="h-3.5 w-3.5" /> View Live Site
            </Link>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link to="/admin/bookings" className="group rounded-2xl border border-[#26221C]/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <CalendarCheck className="h-5 w-5 text-[#C6A15B]" strokeWidth={1.5} />
            <ArrowUpRight className="h-4 w-4 text-[#26221C]/20 group-hover:text-[#C6A15B]" />
          </div>
          <p className="mt-3 font-serif text-2xl text-[#26221C]">{data.operations.bookings.filter((b) => b.status === "checked_in").length}</p>
          <p className="text-xs uppercase tracking-wide text-[#26221C]/45">Guests In-House</p>
        </Link>
        <Link to="/admin/tours" className="group rounded-2xl border border-[#26221C]/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <Ship className="h-5 w-5 text-[#C6A15B]" strokeWidth={1.5} />
            <ArrowUpRight className="h-4 w-4 text-[#26221C]/20 group-hover:text-[#C6A15B]" />
          </div>
          <p className="mt-3 font-serif text-2xl text-[#26221C]">{data.operations.tourBookings.filter((b) => b.status === "confirmed").length}</p>
          <p className="text-xs uppercase tracking-wide text-[#26221C]/45">Upcoming Tours</p>
        </Link>
        <Link to="/admin/rentals" className="group rounded-2xl border border-[#26221C]/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <Bike className="h-5 w-5 text-[#C6A15B]" strokeWidth={1.5} />
            <ArrowUpRight className="h-4 w-4 text-[#26221C]/20 group-hover:text-[#C6A15B]" />
          </div>
          <p className="mt-3 font-serif text-2xl text-[#26221C]">{data.operations.motorbikes.filter((b) => b.status === "rented").length}</p>
          <p className="text-xs uppercase tracking-wide text-[#26221C]/45">Bikes Out</p>
        </Link>
        <Link to="/admin/payments" className="group rounded-2xl border border-[#26221C]/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <CircleDollarSign className="h-5 w-5 text-[#C6A15B]" strokeWidth={1.5} />
            <ArrowUpRight className="h-4 w-4 text-[#26221C]/20 group-hover:text-[#C6A15B]" />
          </div>
          <p className="mt-3 font-serif text-2xl text-[#26221C]">
            {formatPHP(
              data.operations.payments
                .filter((p) => p.direction === "in" && new Date(p.date).getTime() > Date.now() - 30 * 86400000)
                .reduce((s, p) => s + p.amount, 0)
            )}
          </p>
          <p className="text-xs uppercase tracking-wide text-[#26221C]/45">Revenue (30d)</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="group rounded-2xl border border-[#26221C]/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <s.icon className="h-5 w-5 text-[#C6A15B]" strokeWidth={1.5} />
              <ArrowUpRight className="h-4 w-4 text-[#26221C]/20 transition group-hover:text-[#C6A15B]" />
            </div>
            <p className="mt-4 font-serif text-3xl text-[#26221C]">{s.value}</p>
            <p className="text-xs uppercase tracking-wide text-[#26221C]/45">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#26221C]/8 bg-white p-6">
          <h3 className="font-serif text-lg text-[#26221C]">Blog Status</h3>
          <div className="mt-4 flex gap-6">
            <div>
              <p className="font-serif text-2xl text-[#26221C]">{published}</p>
              <p className="text-xs uppercase tracking-wide text-[#26221C]/45">Published</p>
            </div>
            <div>
              <p className="font-serif text-2xl text-[#26221C]">{drafts}</p>
              <p className="text-xs uppercase tracking-wide text-[#26221C]/45">Drafts</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#26221C]/8 bg-white p-6">
          <h3 className="font-serif text-lg text-[#26221C]">Quick Tips</h3>
          <ul className="mt-3 space-y-2 text-sm text-[#26221C]/60">
            <li>• Homepage → reorder or hide sections instantly.</li>
            <li>• Gallery → drag thumbnails to reorder.</li>
            <li>• Pricing → mark one package "Most Popular".</li>
            <li>• Settings → replace the temporary passkey any time.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
