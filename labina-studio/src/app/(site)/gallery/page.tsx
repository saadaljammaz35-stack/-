import type { Metadata } from "next";
import { getGallery } from "@/lib/data/public";
import { PageHeader } from "@/components/site/PageHeader";
import { GalleryGrid } from "@/components/site/GalleryGrid";
import { GalleryEmpty } from "@/components/site/GalleryEmpty";

export const metadata: Metadata = {
  title: "معرض الصور",
  description: "مختارات من جلسات المواليد والأطفال والعائلات وأعياد الميلاد والمناسبات في استوديو لَبِنة.",
};

export default async function GalleryPage() {
  const items = await getGallery();
  return (
    <>
      <PageHeader eyebrow="معرض الصور" title="لحظات صغيرة صنعناها معكم" text="تصفحوا الأعمال حسب نوع الجلسة، واضغطوا على أي صورة لعرضها بحجم أكبر." />
      <div className="container-x">{items.length > 0 ? <GalleryGrid items={items} /> : <GalleryEmpty />}</div>
    </>
  );
}
