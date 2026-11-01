import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpLeft, MessageCircle, Phone } from "lucide-react";
import { getFaqs, getGallery, getServices, getSiteData, getTestimonials } from "@/lib/data/public";
import { BrickMosaic } from "@/components/brand/BrickMosaic";
import { HeroText } from "@/components/site/HeroText";
import { Marquee } from "@/components/site/Marquee";
import { SectionHeading } from "@/components/site/SectionHeading";
import { ServiceCard } from "@/components/site/ServiceCard";
import { Process } from "@/components/site/Process";
import { GalleryGrid } from "@/components/site/GalleryGrid";
import { GalleryEmpty } from "@/components/site/GalleryEmpty";
import { AboutVisual, ValuesGrid } from "@/components/site/AboutBlocks";
import { Testimonials } from "@/components/site/Testimonials";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { HoursList } from "@/components/site/HoursList";
import { BookingForm } from "@/components/booking/BookingForm";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Motion";
import { phoneHref, whatsappHref } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const { home } = await getSiteData();
  return { description: home.seo_description || undefined };
}

export default async function HomePage() {
  const [site, services, gallery, testimonials, faqs] = await Promise.all([
    getSiteData(),
    getServices(),
    getGallery(),
    getTestimonials(),
    getFaqs(),
  ]);
  const { home, contact } = site;
  const featured = gallery.filter((g) => g.is_featured);
  const galleryPreview = (featured.length >= 4 ? featured : gallery).slice(0, 12);

  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="relative">
        <div className="container-x grid items-center gap-12 pb-16 pt-4 md:pt-10 lg:grid-cols-12 lg:gap-10 lg:pb-24 lg:pt-12">
          <div className="lg:col-span-7">
            <HeroText
              eyebrow={home.hero_eyebrow}
              title={home.hero_title}
              subtitle={home.hero_subtitle}
              facts={[`${services.length} أنواع من الجلسات`, "حجز إلكتروني بخطوات بسيطة", "رابط خاص لمتابعة حجزك"]}
            />
          </div>
          <div className="lg:col-span-5">
            <BrickMosaic images={home.hero_images} className="mx-auto max-w-[32rem]" />
          </div>
        </div>
      </section>

      <Marquee />

      {/* ───────── Services ───────── */}
      <section id="services" className="scroll-mt-24 py-16 md:py-28" aria-labelledby="services-title">
        <div className="container-x">
          <SectionHeading
            eyebrow="خدماتنا"
            title={<span id="services-title">كل مرحلة من الطفولة لها جلستها</span>}
            text="من الأيام الأولى إلى أول عيد ميلاد، ومن صورة العائلة إلى ألبوم تلمسونه بأيديكم."
            action={
              <ButtonLink href="/services" variant="outline" icon={<ArrowUpLeft className="size-4" aria-hidden />}>
                كل الخدمات
              </ButtonLink>
            }
          />
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {services.map((s, i) => (
              <Reveal
                key={s.id}
                delay={Math.min(i * 0.05, 0.3)}
                className={i === 0 ? "w-[82%] shrink-0 snap-center sm:col-span-2 sm:w-auto lg:row-span-2" : "w-[82%] shrink-0 snap-center sm:w-auto"}
              >
                <ServiceCard service={s} currency={site.booking.currency} featured={i === 0} />
              </Reveal>
            ))}
            {services.length > 0 && (
              <Reveal className="w-[82%] shrink-0 snap-center sm:w-auto">
                <div className="flex h-full min-h-64 flex-col justify-between rounded-[1.75rem] bg-plum p-7 text-cream">
                  <div className="flex gap-1.5" aria-hidden>
                    <span className="size-4 rounded-[0.3rem] bg-coral" />
                    <span className="size-4 rounded-[0.3rem] bg-sun" />
                    <span className="size-4 rounded-[0.3rem] bg-teal" />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-semibold leading-snug">عندكم فكرة لجلسة مختلفة؟</h3>
                    <p className="mt-3 leading-7 text-cream/75">أخبرونا بها، ونصممها معكم.</p>
                    <ButtonLink href="/contact" variant="sun" size="sm" className="mt-5 h-10">
                      تواصل معنا
                    </ButtonLink>
                  </div>
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      <Process />

      {/* ───────── Gallery ───────── */}
      <section id="gallery" className="scroll-mt-24 py-16 md:py-28" aria-labelledby="gallery-title">
        <div className="container-x">
          <SectionHeading
            eyebrow="معرض الأعمال"
            title={<span id="gallery-title">لحظات من داخل الاستوديو</span>}
            action={
              galleryPreview.length > 0 ? (
                <ButtonLink href="/gallery" variant="outline" icon={<ArrowUpLeft className="size-4" aria-hidden />}>
                  المعرض كاملاً
                </ButtonLink>
              ) : undefined
            }
          />
          {galleryPreview.length > 0 ? <GalleryGrid items={galleryPreview} /> : <GalleryEmpty />}
        </div>
      </section>

      {/* ───────── About ───────── */}
      <section id="about" className="scroll-mt-24 py-16 md:py-28" aria-labelledby="about-title">
        <div className="container-x grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <AboutVisual home={home} />
          </Reveal>
          <div className="lg:col-span-7">
            <Reveal>
              <p className="eyebrow mb-4">من نحن</p>
              <h2 id="about-title" className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.15] text-plum">{home.about_title}</h2>
              {home.about_story && <p className="mt-6 text-lg leading-9 text-ink-soft">{home.about_story}</p>}
            </Reveal>
            <div className="mt-8">
              <ValuesGrid values={home.values} />
            </div>
            <Reveal className="mt-8">
              <Link href="/about" className="inline-flex items-center gap-2 font-semibold text-coral-ink underline decoration-2 underline-offset-8">
                تعرّف على قصتنا
                <ArrowUpLeft className="size-4" aria-hidden />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────── Testimonials (only real ones, added from the dashboard) ───────── */}
      {testimonials.length > 0 && (
        <section className="py-16 md:py-28" aria-labelledby="reviews-title">
          <div className="container-x">
            <SectionHeading eyebrow="آراء العائلات" title={<span id="reviews-title">ماذا قالوا عن تجربتهم</span>} />
            <Testimonials items={testimonials.slice(0, 6)} />
          </div>
        </section>
      )}

      {/* ───────── Booking ───────── */}
      <section id="booking" className="scroll-mt-20 py-16 md:py-28" aria-labelledby="booking-title">
        <div className="container-x">
          <SectionHeading eyebrow="الحجز" title={<span id="booking-title">{home.cta_title}</span>} text={home.cta_text} />
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <BookingForm
                services={services}
                settings={site.booking}
                hours={site.hours}
                blockedDates={site.blockedDates}
                connected={site.connected}
                contact={contact}
              />
            </div>
            <aside className="space-y-4 lg:col-span-4">
              <div className="rounded-[1.75rem] bg-plum p-6 text-cream md:p-7">
                <h3 className="mb-3 font-display text-lg font-semibold text-sun">ساعات العمل</h3>
                <HoursList hours={site.hours} light />
              </div>
              {(contact.whatsapp || contact.phone) && (
                <div className="rounded-[1.75rem] bg-paper p-6 shadow-soft md:p-7">
                  <h3 className="font-display text-lg font-semibold text-plum">تفضّلون الحجز بالهاتف؟</h3>
                  <div className="mt-4 flex flex-col gap-2">
                    {contact.whatsapp && (
                      <a href={whatsappHref(contact.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-teal-ink">
                        <MessageCircle className="size-4" aria-hidden /> واتساب
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${phoneHref(contact.phone)}`} className="inline-flex items-center gap-2 font-semibold text-plum" dir="ltr">
                        <Phone className="size-4" aria-hidden /> {contact.phone}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      {faqs.length > 0 && (
        <section id="faq" className="scroll-mt-24 py-16 md:py-28" aria-labelledby="faq-title">
          <div className="container-x grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <SectionHeading eyebrow="الأسئلة الشائعة" title={<span id="faq-title">قبل أن تسألوا</span>} className="!mb-6" />
              <ButtonLink href="/faq" variant="outline" icon={<ArrowUpLeft className="size-4" aria-hidden />}>
                كل الأسئلة
              </ButtonLink>
            </div>
            <div className="lg:col-span-8">
              <FaqAccordion items={faqs.slice(0, 4)} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
