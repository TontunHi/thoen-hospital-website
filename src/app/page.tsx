import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import './page.css';

async function getLatestNews() {
  try {
    const news = await prisma.news.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          lte: new Date()
        }
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      include: {
        images: {
          orderBy: { order: 'asc' },
          take: 1
        }
      }
    });
    return news;
  } catch {
    return [] as any[];
  }
}



const services = [
  {
    title: 'ห้องฉุกเฉิน',
    desc: 'ให้บริการ 24 ชั่วโมง พร้อมทีมแพทย์และพยาบาลเฉพาะทาง',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 19H5c-1 0-2-1-2-2V7c0-1 1-2 2-2h14c1 0 2 1 2 2v10c0 1-1 2-2 2h-3"/>
        <path d="M12 4v4"/>
        <path d="M10 6h4"/>
        <path d="M9 19l3-3 3 3"/>
        <rect x="8" y="15" width="8" height="6" rx="1"/>
      </svg>
    ),
  },
  {
    title: 'คลินิกเฉพาะทาง',
    desc: 'ตรวจรักษาโดยแพทย์ผู้เชี่ยวชาญเฉพาะทางหลากหลายสาขา',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
        <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
        <circle cx="20" cy="10" r="2"/>
      </svg>
    ),
  },
  {
    title: 'ส่งเสริมสุขภาพ',
    desc: 'บริการตรวจสุขภาพ สร้างเสริมภูมิคุ้มกัน และให้ความรู้ด้านสุขภาพ',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        <path d="M12 5v6"/>
        <path d="M9 8h6"/>
      </svg>
    ),
  },
  {
    title: 'ทันตกรรม',
    desc: 'บริการทันตกรรมครบวงจร ทั้งอุดฟัน ถอนฟัน ขูดหินปูน และทันตกรรมเด็ก',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5.5C10 3 7.5 2.5 6 3c-2.4.8-3.5 3.5-2 7 1 2.5 2 4.5 2.5 7.5.3 1.5.5 3 1.5 3s1.5-1.5 2-3c.3-1 .5-1.5 1-1.5h2c.5 0 .7.5 1 1.5.5 1.5 1 3 2 3s1.2-1.5 1.5-3c.5-3 1.5-5 2.5-7.5 1.5-3.5.4-6.2-2-7-.5-.2-1-.2-1.5-.1"/>
      </svg>
    ),
  },
  {
    title: 'กายภาพบำบัด',
    desc: 'ฟื้นฟูสมรรถภาพร่างกาย โดยนักกายภาพบำบัดผู้เชี่ยวชาญ',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3"/>
        <path d="M12 8v4"/>
        <path d="M8 12h8"/>
        <path d="M10 16l-2 6"/>
        <path d="M14 16l2 6"/>
        <path d="M8 12l-4 3"/>
        <path d="M16 12l4 3"/>
      </svg>
    ),
  },
  {
    title: 'ห้องปฏิบัติการ',
    desc: 'ตรวจวิเคราะห์ทางห้องปฏิบัติการด้วยเครื่องมือที่ทันสมัย',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2h6"/>
        <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
        <path d="M8.5 14.5h7"/>
      </svg>
    ),
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
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
              <span className="hero__stat-num">60</span>
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
            {services.map((service, i) => (
              <div key={i} className="service-card card-glass">
                <div className="service-card__icon">{service.icon}</div>
                <h3 className="service-card__title">{service.title}</h3>
                <p className="service-card__desc">{service.desc}</p>
              </div>
            ))}
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
                <svg className="director__quote-icon" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" opacity="0.15">
                  <path d="M11.3 3.3a1 1 0 0 0-1.4 0l-6.6 6.6a1 1 0 0 0 0 1.4l.3.3c.2.2.5.3.7.3H8v5a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H7.4l4.2-4.2a1 1 0 0 0-.3-1.4zm8 0a1 1 0 0 0-1.4 0l-6.6 6.6a1 1 0 0 0 0 1.4l.3.3c.2.2.5.3.7.3H16v5a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-3.6l4.2-4.2a1 1 0 0 0-.3-1.4z"/>
                </svg>
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
                          <span>👁️ {item.views} วิว</span>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              โทร 054-292016
            </a>
            <Link href="/contact" className="btn btn-gold btn-lg">
              ส่งข้อความถึงเรา
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
