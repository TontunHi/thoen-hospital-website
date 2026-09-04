import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import HeroSlideshow from '@/components/common/HeroSlideshow';

export const dynamic = 'force-dynamic';


import { 
  Phone,
  MessageSquare,
  MapPin
} from 'lucide-react';
import './page.css';
import { FacebookIcon } from '@/components/common/Icons';
import { services, relatedOrgs } from '@/config/home';
import { DbNews, DbAttachment, NewsListItem } from '@/types/news';

async function getLatestNews(): Promise<NewsListItem[]> {
  try {
    const now = new Date()
    const news = await prisma.news.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now }
      },
      orderBy: { startDate: 'desc' },
      take: 20,
      include: {
        attachments: true
      }
    })

    const newsList: NewsListItem[] = (news as unknown as (DbNews & { attachments: DbAttachment[] })[]).map((item) => {
      const imageAttachments = item.attachments.filter((att) => 
        att.fileType && att.fileType.startsWith('image/')
      )
      const images = imageAttachments.map((att) => ({
        id: att.id,
        imageUrl: att.filePath,
        order: 0
      }))

      const pdfAttachment = item.attachments.find((att) => 
        att.fileType === 'application/pdf'
      )

      return {
        id: item.id,
        title: item.title,
        slug: item.slug,
        excerpt: '',
        content: '',
        youtubeUrl: item.youtubeLink,
        pdfUrl: pdfAttachment ? pdfAttachment.filePath : null,
        status: 'PUBLISHED',
        category: item.category,
        views: item.viewCount || 0,
        publishedAt: item.startDate,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        images
      }
    })

    const selected: NewsListItem[] = [];
    const usedCategories = new Set<string>();

    // Select 1 latest from each category
    for (const item of newsList) {
      if (!usedCategories.has(item.category)) {
        selected.push(item);
        usedCategories.add(item.category);
      }
      if (selected.length === 3) {
        break;
      }
    }

    // Fallback: if we have fewer than 3 unique categories, fill with remaining latest news
    if (selected.length < 3) {
      for (const item of newsList) {
        if (!selected.some((s) => s.id === item.id)) {
          selected.push(item);
        }
        if (selected.length === 3) {
          break;
        }
      }
    }

    return selected;
  } catch (error) {
    console.error('Fetch news error:', error)
    return [];
  }
}

async function getActiveSlides() {
  try {
    const now = new Date()
    const slides = await prisma.heroSlide.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now }
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })
    return slides
  } catch (error) {
    console.error('Fetch active slides error:', error)
    return []
  }
}


export default async function HomePage() {
  const latestNews = await getLatestNews();
  const activeSlides = await getActiveSlides();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Schema.org structured data for Hospital
  const hospitalJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Hospital',
    name: 'โรงพยาบาลเถิน (Thoen Hospital)',
    alternateName: 'Thoen Hospital',
    url: siteUrl,
    logo: `${siteUrl}/images/common/logo-website.webp`,
    image: `${siteUrl}/images/common/logo-website.webp`,
    description: 'โรงพยาบาลเถิน จังหวัดลำปาง ให้บริการด้านสุขภาพอย่างครบวงจร ด้วยทีมแพทย์และบุคลากรที่มีคุณภาพ พร้อมดูแลสุขภาพของประชาชนในพื้นที่อำเภอเถินและใกล้เคียง',
    telephone: '054-291568',
    emergencyTelephone: '1669',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '159 หมู่ 7 ถนนพหลโยธิน ตำบลล้อมแรด',
      addressLocality: 'อำเภอเถิน',
      addressRegion: 'จังหวัดลำปาง',
      postalCode: '52160',
      addressCountry: 'TH',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '17.618683',
      longitude: '99.219808',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '00:00',
        closes: '23:59',
      },
    ],
    sameAs: [
      'https://www.facebook.com/thoenhospital',
    ],
  };

  return (
    <div className="home">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hospitalJsonLd) }}
      />

      {/* ===== HERO SECTION ===== */}
      <section className="hero">
        <HeroSlideshow slides={activeSlides} />
      </section>

      {/* ===== SERVICES SECTION ===== */}
      <section className="section services-section">
        <div className="container">
          <div className="section-header">
            <h2>บริการของเรา</h2>
            <p>เรามุ่งเน้นให้บริการสุขภาพที่ครอบคลุมทุกด้าน เพื่อคุณภาพชีวิตที่ดีของชุมชน</p>
          </div>
          <div className="services-grid">
            {services.map((service, i) => {
              const IconComponent = service.icon;
              const CardContent = (
                <>
                  <div className="service-card__accent" />
                  <div className="service-card__icon-container">
                    <IconComponent className="service-card__icon" size={28} />
                  </div>
                  <h3 className="service-card__title">{service.title}</h3>
                  <p className="service-card__desc">{service.desc}</p>
                </>
              )

              if (service.link) {
                return (
                  <Link href={service.link} key={i} className="service-card card-glass" style={{ textDecoration: 'none', display: 'flex', cursor: 'pointer' }}>
                    {CardContent}
                  </Link>
                );
              }

              return (
                <div key={i} className="service-card card-glass">
                  {CardContent}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== DIRECTOR MESSAGE SECTION ===== */}
      <section className="section director-section bg-gray-50">
        <div className="container">
          <div className="director">
            <div className="director__image-wrapper">
              <div className="director__image-frame">
                <Image
                  src="/images/about/board/ceo-thoen.webp"
                  alt="พญ.นฤนาท จอมภาปิน ผู้อำนวยการโรงพยาบาลเถิน"
                  width={400}
                  height={500}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
              <div className="director__image-accent" />
            </div>
            <div className="director__content">
              <span className="badge badge-primary">สารจากผู้อำนวยการ</span>
              <h2 className="director__name">แพทย์หญิง นฤนาท จอมภาปิน</h2>
              <p className="director__position">ผู้อำนวยการโรงพยาบาลเถิน</p>
              <blockquote className="director__quote">
                <p>
                  โรงพยาบาลเถินมุ่งเน้นการพัฒนาระบบบริการให้ประชาชนได้รับการดูแลอย่างทั่วถึงและรวดเร็ว
                  ทั้งด้านการส่งต่อผู้ป่วยฉุกเฉิน การดูแลผู้ป่วยเรื้อรัง และการส่งเสริมสุขภาพในชุมชน
                  ทีมสหสาขาวิชาชีพพร้อมให้บริการด้วยมาตรฐานความปลอดภัย พร้อมขยายเครือข่ายความร่วมมือกับหน่วยงานท้องถิ่น
                  เพื่อยกระดับคุณภาพชีวิตของประชาชนในพื้นที่
                </p>
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LATEST NEWS SECTION ===== */}
      <section className="section news-section">
        <div className="container">
          <div className="section-header">
            <h2>ข่าวสารล่าสุด</h2>
            <p>ติดตามข่าวสาร กิจกรรม และประชาสัมพันธ์ของโรงพยาบาลเถิน</p>
          </div>

          {latestNews.length > 0 ? (
            <>
              <div className="news-list-forum">
                {latestNews.map((item: NewsListItem) => {
                  const getCategoryLabel = (cat: string) => {
                    switch (cat) {
                      case 'PR': return 'ประชาสัมพันธ์'
                      case 'TRAINING': return 'อบรม/สัมมนา'
                      case 'JOBS': return 'รับสมัครงาน'
                      case 'ANNOUNCEMENT': return 'ประกาศ'
                      default: return 'ข่าวสาร'
                    }
                  }

                  return (
                    <Link key={item.id} href={`/news/${item.slug}`} className="news-forum-row">
                      <div className="news-row-meta">
                        <span className={`news-row-category badge-${item.category.toLowerCase()}`}>
                          {getCategoryLabel(item.category)}
                        </span>
                        <time className="news-row-date">
                          {new Date(item.publishedAt).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </time>
                      </div>
                      
                      <h3 className="news-row-title">{item.title}</h3>
                      
                      <span className="news-row-chevron">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </span>
                    </Link>
                  )
                })}
              </div>
              <div className="news-section__more">
                <Link href="/news" className="btn btn-outline">
                  ดูข่าวสารทั้งหมด
                </Link>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
                <path d="M18 14h-8"/>
                <path d="M15 18h-5"/>
                <path d="M10 6h8v4h-8V6Z"/>
              </svg>
              <h3>ยังไม่มีข่าวสาร</h3>
              <p>ขณะนี้ยังไม่มีข่าวสารที่จะแสดง กรุณากลับมาอีกครั้งในภายหลัง</p>
            </div>
          )}
        </div>
      </section>



      {/* ===== SOCIAL & MAPS SECTION ===== */}
      <section className="section social-map-section bg-gray-50">
        <div className="container">
          <div className="social-map-grid">
            <div className="facebook-embed-card card">
              <div className="card-header-with-icon">
                <FacebookIcon className="text-primary" size={24} />
                <h2>ติดตามเราบน Facebook</h2>
              </div>
              <p className="section-sub">เกาะติดข่าวสารและกิจกรรมผ่าน Facebook Fanpage</p>
              <div className="facebook-wrapper">
                <iframe
                  src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2FThoenHospital1669&tabs=timeline&width=500&height=450&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true&appId"
                  width="100%"
                  height="450"
                  style={{ border: 'none', overflow: 'hidden', borderRadius: '8px' }}
                  scrolling="no"
                  frameBorder="0"
                  allowFullScreen={true}
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  title="Facebook Page - โรงพยาบาลเถิน"
                />
              </div>
            </div>

            <div className="google-map-embed-card card">
              <div className="card-header-with-icon">
                <MapPin className="text-primary" size={24} />
                <h2>แผนที่และการเดินทาง</h2>
              </div>
              <p className="section-sub">แผนที่แสดงพิกัดนำทางโรงพยาบาลเถิน จังหวัดลำปาง</p>
              <div className="map-wrapper">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3765.2312965383568!2d99.2379647!3d17.6371055!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30dea78c00000001%3A0xcab5fbfb134039ab!2sThoen%20Hospital!5e0!3m2!1sth!2sth!4v1716888495000!5m2!1sth!2sth"
                width="100%"
                height="450"
                style={{ border: 0, borderRadius: '8px' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Google Maps - โรงพยาบาลเถิน"
              />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RELATED ORGANIZATIONS SECTION ===== */}
      <section className="section related-orgs-section bg-gray-50">
        <div className="container">
          <div className="section-header">
            <h2>หน่วยงานที่เกี่ยวข้อง</h2>
            <p>ลิงก์เชื่อมโยงไปยังหน่วยงานราชการและสถานพยาบาลเครือข่ายที่เกี่ยวข้อง</p>
          </div>
          <div className="related-orgs-grid">
            {relatedOrgs.map((org, index) => {
              if (org.url) {
                return (
                  <a 
                    key={index} 
                    href={org.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="org-link-badge card"
                  >
                    {org.name}
                  </a>
                );
              }
              return (
                <span 
                  key={index} 
                  className="org-link-badge card disabled"
                  title="ยังไม่มีลิงก์เชื่อมโยง"
                >
                  {org.name}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== QUICK CONTACT SECTION ===== */}
      <section className="cta-section">
        <div className="cta__bg" />
        <div className="container cta__content">
          <h2 className="cta__title">ต้องการความช่วยเหลือ?</h2>
          <p className="cta__desc">
            ทีมแพทย์และบุคลากรของเราพร้อมให้บริการคุณ ติดต่อเราได้ตลอด 24 ชั่วโมง
          </p>
          <div className="cta__actions">
            <a href="tel:054292016" className="btn btn-white btn-lg">
              <Phone size={20} />
              โทร 054-292016
            </a>
            <Link href="/contact" className="btn btn-gold btn-lg">
              <MessageSquare size={20} />
              ส่งข้อความถึงเรา
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
