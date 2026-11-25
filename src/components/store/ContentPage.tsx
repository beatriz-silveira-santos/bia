import { notFound } from "next/navigation";
import { supabasePublic } from "@/lib/supabase/server";
import { renderMarkdown } from "@/lib/markdown";
import { Breadcrumbs } from "./Breadcrumbs";

export async function getContentPage(slug: string) {
  const { data } = await supabasePublic().from("content_pages").select("slug,title,body_markdown,reviewed_by_owner,updated_at").eq("slug", slug).maybeSingle();
  return data;
}

export async function ContentPage({ slug, crumbs }: { slug: string; crumbs?: { label: string; href?: string }[] }) {
  const page = await getContentPage(slug);
  if (!page) notFound();
  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <Breadcrumbs items={[...(crumbs ?? []), { label: page.title }]} />
      <h1 className="mb-6 mt-6 text-4xl sm:text-5xl">{page.title}</h1>
      {!page.reviewed_by_owner && process.env.APP_ENV !== "production" && (
        <p className="mb-6 rounded-xl bg-warning-bg px-4 py-3 text-sm">Rascunho: este texto ainda precisa ser revisado e aprovado pela proprietária.</p>
      )}
      <div className="prose-store" dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body_markdown) }} />
    </div>
  );
}
