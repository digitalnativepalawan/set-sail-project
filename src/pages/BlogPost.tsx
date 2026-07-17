import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Tag } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { ImagePlaceholder } from "@/components/site/ImagePlaceholder";
import { Reveal } from "@/components/site/Reveal";
import { sanitizeHtml } from "@/lib/security";

export default function BlogPost() {
  const { slug } = useParams();
  const { data } = useCms();
  const post = data.blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAF6EF] px-6 text-center">
        <h1 className="font-serif text-3xl text-[#26221C]">Post Not Found</h1>
        <Link to="/blog" className="text-sm text-[#8A6B32] underline">Back to Journal</Link>
      </div>
    );
  }

  const categories = data.blogCategories.filter((c) => post.categoryIds.includes(c.id));

  return (
    <article className="min-h-screen bg-[#FAF6EF] pb-24 pt-36">
      <div className="mx-auto max-w-3xl px-6 lg:px-12">
        <Link to="/blog" className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[#26221C]/50 hover:text-[#8A6B32]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Journal
        </Link>

        <Reveal>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-[#26221C]/40">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />
              {new Date(post.publishAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </span>
            {categories.map((c) => (
              <span key={c.id} className="flex items-center gap-1 rounded-full bg-[#C6A15B]/15 px-2.5 py-1 text-[#8A6B32]">
                {c.name}
              </span>
            ))}
          </div>
          <h1 className="font-serif text-3xl leading-tight text-[#26221C] sm:text-5xl">{post.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-[#26221C]/60">{post.excerpt}</p>
        </Reveal>

        <Reveal delay={0.1} className="my-10">
          <ImagePlaceholder mediaId={post.featuredImageId} className="aspect-[16/9] w-full" />
        </Reveal>

        <Reveal delay={0.15}>
          <div
            className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:text-[#26221C] prose-p:text-[#26221C]/75 prose-p:leading-relaxed prose-a:text-[#8A6B32] prose-iframe:aspect-video prose-iframe:w-full"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
          />
        </Reveal>

        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-[#26221C]/10 pt-8">
            <Tag className="h-4 w-4 text-[#26221C]/40" />
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs text-[#26221C]/60 shadow-sm">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
