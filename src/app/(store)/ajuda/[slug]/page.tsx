import type { Metadata } from "next";
import { ContentPage, getContentPage } from "@/components/store/ContentPage";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getContentPage(slug);
  return p ? { title: p.title, alternates: { canonical: `/ajuda/${slug}` } } : {};
}
export default async function HelpPage({ params }: Props) {
  const { slug } = await params;
  return <ContentPage slug={slug} crumbs={[{ label: "Ajuda" }]} />;
}
