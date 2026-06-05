'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import './page.css';

interface DocumentItem {
  title: string;
  fileUrl?: string;
  subItems?: { title: string; fileUrl: string }[];
}

function EthicsPageContent() {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get('year');
  const [activeYear, setActiveYear] = useState<'2569' | '2568' | '2567'>('2569');

  useEffect(() => {
    if (yearParam === '2568' || yearParam === '2569' || yearParam === '2567') {
      setActiveYear(yearParam);
    }
  }, [yearParam]);

  const ethicsData: Record<'2569' | '2568' | '2567', DocumentItem[]> = {
    '2569': [
      {
        title: '1. คำสั่งคณะทำงานขับเคลื่อนชมรมจริยธรรมของหน่วยงาน',
        fileUrl: '/documents/ethics/2569/command.pdf',
      },
      {
        title: '2. แผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมของหน่วยงาน',
        fileUrl: '/documents/ethics/2569/action-plan.pdf',
      },
      {
        title: '3. รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมโรงพยาบาลเถิน',
        subItems: [
          {
            title: 'รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของหน่วยงาน รอบ 6 เดือน',
            fileUrl: '/documents/ethics/2569/report-6m.pdf',
          },
          {
            title: 'รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของหน่วยงาน รอบ 12 เดือน',
            fileUrl: '/documents/ethics/2569/report-12m.pdf',
          },
        ],
      },
    ],
    '2568': [
      {
        title: '1. คำสั่งคณะทำงานขับเคลื่อนชมรมจริยธรรมของหน่วยงาน',
        fileUrl: '/documents/ethics/2568/command.pdf',
      },
      {
        title: '2. แผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมของหน่วยงาน',
        fileUrl: '/documents/ethics/2568/action-plan.pdf',
      },
      {
        title: '3. รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมโรงพยาบาลเถิน',
        subItems: [
          {
            title: 'รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของหน่วยงาน รอบ 6 เดือน',
            fileUrl: '/documents/ethics/2568/report-6m.pdf',
          },
          {
            title: 'รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของหน่วยงาน รอบ 12 เดือน',
            fileUrl: '/documents/ethics/2568/report-12m.pdf',
          },
        ],
      },
    ],
    '2567': [
      {
        title: '1. คำสั่งคณะทำงานขับเคลื่อนชมรมจริยธรรมของหน่วยงาน',
        fileUrl: '/documents/ethics/2567/command.pdf',
      },
      {
        title: '2. แผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมของหน่วยงาน',
        fileUrl: '/documents/ethics/2567/action-plan.pdf',
      },
      {
        title: '3. รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมโรงพยาบาลเถิน',
        fileUrl: '/documents/ethics/2567/report.pdf',
      },
    ],
  };

  return (
    <div className="container ethics-page">
      <div className="ethics-header">
        <h1>ชมรมจริยธรรม</h1>
        <p className="ethics-subtitle">
          ศูนย์รวมเอกสาร แผนการดำเนินงาน และคำสั่งคณะทำงานขับเคลื่อนชมรมจริยธรรม โรงพยาบาลเถิน
        </p>
      </div>

      <div className="ethics-year-selector">
        <button
          className={`year-tab ${activeYear === '2569' ? 'active' : ''}`}
          onClick={() => setActiveYear('2569')}
        >
          ปีงบประมาณ 2569
        </button>
        <button
          className={`year-tab ${activeYear === '2568' ? 'active' : ''}`}
          onClick={() => setActiveYear('2568')}
        >
          ปีงบประมาณ 2568
        </button>
        <button
          className={`year-tab ${activeYear === '2567' ? 'active' : ''}`}
          onClick={() => setActiveYear('2567')}
        >
          ปีงบประมาณ 2567
        </button>
      </div>

      <div className="ethics-content">
        <h2 className="section-title">
          เอกสารชมรมจริยธรรม ประจำปีงบประมาณ {activeYear}
        </h2>

        <div className="document-list">
          {ethicsData[activeYear].map((item, index) => (
            <div key={index} className="document-card card">
              {item.fileUrl ? (
                <div className="document-row">
                  <div className="document-info">
                    <span className="pdf-icon">📄</span>
                    <h3 className="document-title">{item.title}</h3>
                  </div>
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm btn-download"
                  >
                    เปิดดูเอกสาร
                  </a>
                </div>
              ) : (
                <div className="document-group">
                  <h3 className="document-group-title">{item.title}</h3>
                  {item.subItems && (
                    <div className="sub-document-list">
                      {item.subItems.map((sub, sIdx) => (
                        <div key={sIdx} className="sub-document-row">
                          <div className="document-info">
                            <span className="pdf-icon sub-icon">🔗</span>
                            <span className="sub-document-title">{sub.title}</span>
                          </div>
                          <a
                            href={sub.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm btn-download"
                          >
                            เปิดดูเอกสาร
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EthicsPage() {
  return (
    <Suspense fallback={<div className="container ethics-page"><div className="text-center">กำลังโหลด...</div></div>}>
      <EthicsPageContent />
    </Suspense>
  );
}
