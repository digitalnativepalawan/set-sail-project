import { useState } from "react";
import { Plus, Trash2, Pencil, Eye, Calendar, Search } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Select, Modal, Badge } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { MediaPickerButton } from "../shared/MediaPicker";
import { RichTextEditor } from "../shared/RichTextEditor";
import type { BlogPost, BlogStatus } from "@/types/cms";

const emptyPost = (): BlogPost => ({
  id: `post_${Date.now()}`,
  title: "",
  slug: "",
  excerpt: "",
  content: "<p>Start writing…</p>",
  featuredImageId: "",
  images: [],
  categoryIds: [],
  tags: [],
  status: "draft",
  publishAt: new Date().toISOString().slice(0, 16),
  seoTitle: "",
  seoDescription: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

const STATUS_STYLE: Record<BlogStatus, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
};

export default function BlogManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [creatingCategory, setCreatingCategory] = useState("");
  const [search, setSearch] = useState("");

  const posts = data.blogPosts
    .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const savePost = (post: BlogPost) => {
    const exists = data.blogPosts.some((p) => p.id === post.id);
    const next = exists ? data.blogPosts.map((p) => (p.id === post.id ? post : p)) : [...data.blogPosts, post];
    update((d) => ({ ...d, blogPosts: next }));
    notify(exists ? "Post updated" : "Post created");
    setEditing(null);
  };

  const deletePost = (id: string) => {
    update((d) => ({ ...d, blogPosts: d.blogPosts.filter((p) => p.id !== id) }));
    notify("Post deleted");
  };

  const addCategory = () => {
    if (!creatingCategory.trim()) return;
    update((d) => ({
      ...d,
      blogCategories: [...d.blogCategories, { id: `cat_${Date.now()}`, name: creatingCategory, slug: slugify(creatingCategory) }],
    }));
    setCreatingCategory("");
    notify("Category added");
  };

  return (
    <div>
      <PageHeader
        title="Blog CMS"
        description="Write and manage posts with a rich text editor, categories, tags, featured images, SEO fields and scheduled publishing."
        actions={<Button onClick={() => setEditing(emptyPost())}><Plus className="h-4 w-4" /> New Post</Button>}
      />

      <div className="mb-6 flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
          <Input placeholder="Search posts…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card className="mb-8 p-5">
        <p className="mb-3 text-sm font-medium text-[#26221C]">Categories</p>
        <div className="flex flex-wrap items-center gap-2">
          {data.blogCategories.map((c) => <Badge key={c.id}>{c.name}</Badge>)}
          <Input value={creatingCategory} onChange={(e) => setCreatingCategory(e.target.value)} placeholder="New category" className="w-40" />
          <Button size="sm" variant="outline" onClick={addCategory}><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
      </Card>

      {posts.length === 0 ? (
        <EmptyState title="No posts found" description="Create your first blog post." />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-serif text-base text-[#26221C]">{post.title || "Untitled Post"}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLE[post.status]}`}>
                    {post.status}
                  </span>
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#26221C]/45">
                  <Calendar className="h-3 w-3" /> {new Date(post.publishAt).toLocaleString()}
                  <span className="mx-1">·</span>/blog/{post.slug || "untitled"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {post.status === "published" && (
                  <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-[#26221C]/50 hover:bg-[#26221C]/5">
                    <Eye className="h-4 w-4" />
                  </a>
                )}
                <button onClick={() => setEditing(post)} className="rounded-lg p-2 text-[#26221C]/50 hover:bg-[#26221C]/5">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => deletePost(post.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <PostEditorModal
          post={editing}
          categories={data.blogCategories}
          onClose={() => setEditing(null)}
          onSave={savePost}
        />
      )}
    </div>
  );
}

function PostEditorModal({
  post,
  categories,
  onClose,
  onSave,
}: {
  post: BlogPost;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSave: (post: BlogPost) => void;
}) {
  const [draft, setDraft] = useState<BlogPost>(post);

  const patch = (p: Partial<BlogPost>) => setDraft((d) => ({ ...d, ...p, updatedAt: new Date().toISOString() }));

  return (
    <Modal open onClose={onClose} title={post.title ? "Edit Post" : "New Post"} wide>
      <div className="max-h-[75vh] space-y-5 overflow-y-auto admin-scroll pr-1">
        <Field label="Title">
          <Input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value, slug: draft.slug || slugify(e.target.value) })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="URL Slug">
            <Input value={draft.slug} onChange={(e) => patch({ slug: slugify(e.target.value) })} />
          </Field>
          <Field label="Status">
            <Select value={draft.status} onChange={(e) => patch({ status: e.target.value as BlogStatus })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
            </Select>
          </Field>
        </div>
        {draft.status === "scheduled" && (
          <Field label="Publish Date &amp; Time">
            <Input type="datetime-local" value={draft.publishAt.slice(0, 16)} onChange={(e) => patch({ publishAt: e.target.value })} />
          </Field>
        )}
        <Field label="Excerpt">
          <Textarea rows={2} value={draft.excerpt} onChange={(e) => patch({ excerpt: e.target.value })} />
        </Field>
        <Field label="Featured Image">
          <MediaPickerButton value={draft.featuredImageId} onChange={(id) => patch({ featuredImageId: id })} />
        </Field>
        <Field label="Content">
          <RichTextEditor value={draft.content} onChange={(html) => patch({ content: html })} />
        </Field>
        <Field label="Embed a YouTube Video (optional)" hint="Paste a link and we'll add an embed block to the content">
          <div className="flex gap-2">
            <Input
              placeholder="https://youtube.com/watch?v=…"
              id="yt-embed-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = (e.target as HTMLInputElement).value;
                  const match = val.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
                  if (match) {
                    patch({ content: draft.content + `<p><iframe width="100%" height="360" src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allowfullscreen></iframe></p>` });
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
            />
          </div>
        </Field>
        <Field label="Categories">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = draft.categoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    patch({ categoryIds: active ? draft.categoryIds.filter((id) => id !== c.id) : [...draft.categoryIds, c.id] })
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active ? "bg-[#C6A15B] text-[#221D14]" : "bg-[#26221C]/5 text-[#26221C]/60 hover:bg-[#26221C]/10"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Tags" hint="Comma-separated">
          <Input
            value={draft.tags.join(", ")}
            onChange={(e) => patch({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
          />
        </Field>

        <div className="rounded-xl border border-[#26221C]/10 bg-[#FAF6EF] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8A6B32]">SEO</p>
          <div className="space-y-3">
            <Field label="SEO Title">
              <Input value={draft.seoTitle} onChange={(e) => patch({ seoTitle: e.target.value })} />
            </Field>
            <Field label="Meta Description">
              <Textarea rows={2} value={draft.seoDescription} onChange={(e) => patch({ seoDescription: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-[#26221C]/10 pt-5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(draft)} disabled={!draft.title.trim()}>Save Post</Button>
      </div>
    </Modal>
  );
}
