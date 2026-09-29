import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import HeroSlideshow from '@/components/common/HeroSlideshow';
import { 
  Phone,
  MessageSquare,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import './page.css';
import { FacebookIcon } from '@/components/common/Icons';
import { services, relatedOrgs } from '@/config/home';
import { siteConfig } from '@/config/site';
import { DbNews, DbAttachment, NewsListItem } from '@/types/news';

export const dynamic = 'force-dynamic';

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
  const siteUrl = siteConfig.url;

  // Schema.org structured data for Hospital (W4)
  const hospitalJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Hospital',
    name: `${siteConfig.name} (${siteConfig.englishName})`,
    alternateName: siteConfig.englishName,
    url: siteUrl,
    logo: `${siteUrl}/images/common/logo-website.webp`,
    image: `${siteUrl}/images/common/logo-website.webp`,
    description: siteConfig.description,
    telephone: siteConfig.contact.hospitalPhone,
    emergencyTelephone: siteConfig.contact.emergencyPhone,
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
      latitude: String(siteConfig.contact.coordinates.latitude),
      longitude: String(siteConfig.contact.coordinates.longitude),
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
      siteConfig.contact.facebook,
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
                    <Link key={item.id} href={`/news/${item.slug}`} className="news-forum-row touch-target">
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
                        <ChevronRight size={18} />
                      </span>
                    </Link>
                  )
                })}
              </div>
              <div className="news-section__more">
                <Link href="/news" className="btn btn-outline touch-target">
                  ดูข่าวสารทั้งหมด
                </Link>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>ขณะนี้ยังไม่มีข่าวสารที่จะแสดง กรุณากลับมาอีกครั้งในภายหลัง</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== SERVICES SECTION ===== */}
      <section className="section services-section bg-gray-50">
        <div className="container">
          <div className="section-header">
            <h2>บริการและโปรแกรมการรักษา</h2>
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
                  <Link href={service.link} key={i} className="service-card card-glass touch-target" style={{ textDecoration: 'none', display: 'flex', cursor: 'pointer' }}>
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

      {/* ===== SOCIAL & FACEBOOK SECTION ===== */}
      <section className="section social-map-section">
        <div className="container">
          <div className="social-map-grid full-width">
            <div className="facebook-embed-card card">
              <div className="card-header-with-icon">
                <FacebookIcon className="text-primary" size={24} />
                <h2>ติดตามเราบน Facebook</h2>
              </div>
              <p className="section-sub">เกาะติดข่าวสารและกิจกรรมผ่าน Facebook Fanpage โรงพยาบาลเถิน</p>
              <div className="facebook-wrapper">
                <iframe
                  src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2FThoenHospital1669&tabs=timeline&width=500&height=550&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true&appId"
                  width="100%"
                  height="550"
                  style={{ border: 'none', overflow: 'hidden', borderRadius: '8px' }}
                  scrolling="no"
                  allowFullScreen={true}
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  title="Facebook Page - โรงพยาบาลเถิน"
                  loading="lazy"
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
                    className="org-link-badge card touch-target"
                  >
                    <span>{org.name}</span>
                    <ExternalLink size={12} aria-hidden="true" style={{ marginLeft: '4px' }} />
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

      {/* ===== QUICK CONTACT CTA SECTION ===== */}
      <section className="cta-section">
        <div className="cta__bg" />
        <div className="container cta__content">
          <h2 className="cta__title">ต้องการความช่วยเหลือด้านสุขภาพ?</h2>
          <p className="cta__desc">
            ทีมแพทย์และบุคลากรโรงพยาบาลเถินพร้อมให้บริการและดูแลคุณตลอด 24 ชั่วโมง
          </p>
          <div className="cta__actions">
            <a href={`tel:${siteConfig.contact.hospitalPhone}`} className="btn btn-white btn-lg touch-target">
              <Phone size={20} />
              <span>โทร {siteConfig.contact.hospitalPhone}</span>
            </a>
            <Link href="/contact" className="btn btn-gold btn-lg touch-target" style={{ backgroundColor: 'var(--accent-gold-dark)', color: '#ffffff', borderColor: 'transparent' }}>
              <MessageSquare size={20} />
              <span>ส่งข้อความ / ข้อเสนอแนะ</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
