import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { ImagePlaceholder } from "@/components/site/ImagePlaceholder";
import { Reveal } from "@/components/site/Reveal";

export default function BlogList() {
  const { data } = useCms();
  const posts = data.blogPosts
    .filter((p) => p.status === "published")
    .sort((a, b) => new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime());

  return (
    <div className="min-h-screen bg-[#FAF6EF] pb-24 pt-36">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#C6A15B]">Journal</p>
          <h1 className="font-serif text-4xl text-[#26221C] sm:text-5xl">Notes From the Rooftop</h1>
          <p className="mt-4 text-base leading-relaxed text-[#26221C]/60">
            Stories, guides and reflections on remote work, Palawan travel, and life at Marina Terrace.
          </p>
        </Reveal>

        {posts.length === 0 ? (
          <p className="text-center text-[#26221C]/50">No posts published yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <Reveal key={post.id} delay={i * 0.06}>
                <Link to={`/blog/${post.slug}`} className="group block">
                  <ImagePlaceholder mediaId={post.featuredImageId} className="aspect-[4/3] w-full" />
                  <div className="mt-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#26221C]/40">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(post.publishAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                    </div>
                    <h2 className="mt-2 font-serif text-xl text-[#26221C] transition-colors group-hover:text-[#8A6B32]">
                      {post.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#26221C]/60">{post.excerpt}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
