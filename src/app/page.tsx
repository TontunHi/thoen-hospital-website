import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { 
  Activity, 
  Stethoscope, 
  HeartPulse, 
  Smile, 
  Accessibility, 
  FlaskConical,
  Phone,
  MessageSquare,
  MapPin,
  Newspaper
} from 'lucide-react';
import './page.css';

const FacebookIcon = (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg 
    width={props.size || 24} 
    height={props.size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

async function getLatestNews() {
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

    const newsList = news.map((item: any) => {
      const imageAttachments = item.attachments.filter((att: any) => 
        att.fileType && att.fileType.startsWith('image/')
      )
      const images = imageAttachments.map((att: any) => ({
        id: att.id,
        imageUrl: att.filePath,
        order: 0
      }))

      const pdfAttachment = item.attachments.find((att: any) => 
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

    const selected: typeof newsList = [];
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
        if (!selected.some((s: any) => s.id === item.id)) {
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



const services = [
  {
    title: 'ห้องฉุกเฉิน',
    desc: 'ให้บริการ 24 ชั่วโมง พร้อมทีมแพทย์และพยาบาลเฉพาะทาง',
    icon: Activity
  },
  {
    title: 'คลินิกเฉพาะทาง',
    desc: 'ตรวจรักษาโดยแพทย์ผู้เชี่ยวชาญเฉพาะทางหลากหลายสาขา',
    icon: Stethoscope
  },
  {
    title: 'ส่งเสริมสุขภาพ',
    desc: 'บริการตรวจสุขภาพ สร้างเสริมภูมิคุ้มกัน และให้ความรู้ด้านสุขภาพ',
    icon: HeartPulse
  },
  {
    title: 'ทันตกรรม',
    desc: 'บริการทันตกรรมครบวงจร ทั้งอุดฟัน ถอนฟัน ขูดหินปูน และทันตกรรมเด็ก',
    icon: Smile
  },
  {
    title: 'กายภาพบำบัด',
    desc: 'ฟื้นฟูสมรรถภาพร่างกาย โดยนักกายภาพบำบัดผู้เชี่ยวชาญ',
    icon: Accessibility
  },
  {
    title: 'ห้องปฏิบัติการ',
    desc: 'ตรวจวิเคราะห์ทางห้องปฏิบัติการด้วยเครื่องมือที่ทันสมัย',
    icon: FlaskConical
  },
];

export default async function HomePage() {
  const latestNews = await getLatestNews();

  return (
    <div className="home">
      {/* ===== HERO SECTION ===== */}
      <section className="hero">
        <div className="hero__bg">
          <Image
            src="/images/main-banner.webp"
            alt="โรงพยาบาลเถิน จังหวัดลำปาง"
            fill
            priority
            style={{ objectFit: 'cover' }}
            sizes="100vw"
          />
          <div className="hero__overlay" />
        </div>
        <div className="container hero__content">
          <div className="hero__badge">
            ดูแลสุขภาพชุมชน ด้วยหัวใจ
          </div>
          <h1 className="hero__title">
            โรงพยาบาลเถิน
            <span className="hero__title-sub">จังหวัดลำปาง</span>
          </h1>
          <p className="hero__desc">
            ให้บริการด้านสุขภาพอย่างครบวงจร ด้วยทีมแพทย์และบุคลากรที่มีคุณภาพ
            <br />พร้อมดูแลสุขภาพของประชาชนในพื้นที่ด้วยมาตรฐานความปลอดภัย
          </p>
          <div className="hero__actions">
            <Link href="/about" className="btn btn-white btn-lg">
              เกี่ยวกับเรา
            </Link>
            <Link href="/contact" className="btn btn-outline btn-lg hero__btn-outline">
              ติดต่อเรา
            </Link>
          </div>
          <div className="hero__stats">
            <div className="hero__stat">
              <span className="hero__stat-num">90</span>
              <span className="hero__stat-label">เตียง</span>
            </div>
            <div className="hero__stat-divider" />
            <div className="hero__stat">
              <span className="hero__stat-num">24</span>
              <span className="hero__stat-label">ชม. ฉุกเฉิน</span>
            </div>
            <div className="hero__stat-divider" />
            <div className="hero__stat">
              <span className="hero__stat-num">50+</span>
              <span className="hero__stat-label">บุคลากร</span>
            </div>
          </div>
        </div>
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
              return (
                <div key={i} className="service-card card-glass">
                  <div className="service-card__accent" />
                  <div className="service-card__icon-container">
                    <IconComponent className="service-card__icon" size={28} />
                  </div>
                  <h3 className="service-card__title">{service.title}</h3>
                  <p className="service-card__desc">{service.desc}</p>
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
                  src="/images/ceo-thoen.webp"
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
              <h2 className="director__name">พญ.นฤนาท จอมภาปิน</h2>
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
              <div className="news-grid">
                {latestNews.map((item: any) => {
                  const coverImage = item.images && item.images.length > 0 ? item.images[0].imageUrl : null
                  return (
                    <Link key={item.id} href={`/news/${item.slug}`} className="news-card card">
                      <div className="news-card__image">
                        {coverImage ? (
                          <Image
                            src={coverImage}
                            alt={item.title}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                        ) : (
                          <div className="news-card__placeholder">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2"/>
                              <path d="m3 16 5-5c.928-.893 2.072-.893 3 0l5 5"/>
                              <path d="m14 14 1-1c.928-.893 2.072-.893 3 0l3 3"/>
                              <circle cx="15.5" cy="8.5" r="1.5"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="news-card__body">
                        <div className="news-card__meta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                          <time className="news-card__date" style={{ margin: 0 }}>
                            {new Date(item.publishedAt).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </time>
                          
                        </div>
                        <h3 className="news-card__title">{item.title}</h3>
                        <p className="news-card__excerpt">{item.excerpt || (item.content ? item.content.substring(0, 100) + '...' : '')}</p>
                      <span className="news-card__link">
                        อ่านต่อ
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14"/>
                          <path d="m12 5 7 7-7 7"/>
                        </svg>
                      </span>
                    </div>
                  </Link>
                )})
                }
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
