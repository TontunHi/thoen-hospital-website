import './page.css';

interface ItaItem {
  year: string;
  title: string;
  url: string;
  status?: string;
}

export const metadata = {
  title: 'ITA การประเมินคุณธรรมและความโปร่งใส | โรงพยาบาลเถิน',
  description: 'การประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของหน่วยงานภาครัฐ (Integrity & Transparency Assessment) โรงพยาบาลเถิน จังหวัดลำปาง',
};

export default function ItaPage() {
  const itaData: ItaItem[] = [
    {
      year: '2569',
      title: 'การประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของหน่วยงานภาครัฐ (Integrity & Transparency Assessment) ประจำปีงบประมาณ 2569',
      url: 'https://sites.google.com/thoenhospital.com/ita-2569-11152/ita',
      status: 'ปีงบประมาณปัจจุบัน',
    },
    {
      year: '2568',
      title: 'การประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของหน่วยงานภาครัฐ (Integrity & Transparency Assessment) ประจำปีงบประมาณ 2568',
      url: 'https://sites.google.com/thoenhospital.com/ita-11152/ita',
    },
    {
      year: '2567',
      title: 'การประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของหน่วยงานภาครัฐ (Integrity & Transparency Assessment) ประจำปีงบประมาณ 2567',
      url: 'http://www.thlp.moph.go.th/11152/ITA/2567/index.php',
    },
    {
      year: '2566',
      title: 'การประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของหน่วยงานภาครัฐ (Integrity & Transparency Assessment) ประจำปีงบประมาณ 2566',
      url: 'http://www.thlp.moph.go.th/11152/ITA/2567/index.php',
    },
    {
      year: '2565',
      title: 'การประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของหน่วยงานภาครัฐ (Integrity & Transparency Assessment) ประจำปีงบประมาณ 2565',
      url: 'http://www.thlp.moph.go.th/11152/ITA/2565/index.php',
    },
  ];

  return (
    <div className="container ita-page">
      <div className="ita-header">
        <h1>ITA (Integrity & Transparency Assessment)</h1>
        <p className="ita-subtitle">
          การประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของหน่วยงานภาครัฐ โรงพยาบาลเถิน
        </p>
      </div>

      <div className="ita-content">
        <div className="ita-grid">
          {itaData.map((item) => (
            <div key={item.year} className="ita-card card">
              <div className="ita-card-header">
                <span className="ita-year-badge">ปีงบประมาณ {item.year}</span>
                {item.status && <span className="ita-status-badge">{item.status}</span>}
              </div>
              <div className="ita-card-body">
                <h2 className="ita-title">{item.title}</h2>
                <p className="ita-desc">
                  เข้าชมหน้าเว็บประเมินผล รวบรวมหัวข้อการเปิดเผยข้อมูลสาธารณะ (OIT) และแบบตรวจวัดการรับรู้ของบุคลากรภายในและผู้รับบริการภายนอก
                </p>
              </div>
              <div className="ita-card-footer">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-block"
                >
                  เข้าสู่เว็บไซต์ ITA {item.year} <span className="external-icon">↗</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
