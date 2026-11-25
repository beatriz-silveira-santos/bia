import type { Metadata } from "next";
import { ContentPage } from "@/components/store/ContentPage";
export const metadata: Metadata = { title: "Sobre", alternates: { canonical: "/sobre" } };
export default function Page() { return <ContentPage slug="sobre" />; }
