'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Pill,
  Search,
  RefreshCw,
  Clock,
  User,
  Building,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Filter,
  Users,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import './page.css';

interface DispensedItem {
  hn: string;
  fullname: string;
  age: number;
  status: 'OPD' | 'IPD';
  vstdate: string;
  rxdate: string;
  rxtime: string;
  qty: number;
  doctorName: string;
  department: string;
}

interface SummaryData {
  totalCount: number;
  totalQty: number;
  opdCount: number;
  ipdCount: number;
  adultCount: number;
}

export default function LoratadineDispenseClient() {
  const [items, setItems] = useState<DispensedItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Filter States
  const [ageFilter, setAgeFilter] = useState<'adult' | 'all'>('adult');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch Data Function
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(`/api/service/loratadine-dispense?age=${ageFilter}&t=${Date.now()}`, {
        cache: 'no-store'
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถดึงข้อมูลรายการจ่ายยาได้');
      }

      setItems(data.items || []);
      setSummary(data.summary || null);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบฐานข้อมูล HOSxP');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ageFilter]);

  // Initial and on filter change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval (20 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Unique Departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.department) set.add(item.department);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Dept filter
      if (selectedDept !== 'ALL' && item.department !== selectedDept) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchHn = item.hn.toLowerCase().includes(query);
        const matchName = item.fullname.toLowerCase().includes(query);
        const matchDoctor = item.doctorName.toLowerCase().includes(query);
        const matchDept = item.department.toLowerCase().includes(query);
        return matchHn || matchName || matchDoctor || matchDept;
      }
      return true;
    });
  }, [items, selectedDept, searchQuery]);

  // Format Time Helper
  const formatTimeAgo = (date: Date) => {
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
  };

  return (
    <div className="loratadinePage">
      <div className="container">

        {/* Back Button & Breadcrumbs */}
        <div className="navBarBack">
          <Link href="/service" className="backLink">
            <ChevronLeft size={18} />
            <span>กลับหน้าระบบงานภายใน</span>
          </Link>
        </div>

        {/* Header Hero Banner */}
        <header className="pageHeaderCard animate-fadeIn">
          <div className="headerContent">
            <div className="iconContainer">
              <Pill size={32} />
            </div>
            <div className="headerText">
              <div className="badgeRow">
                <span className="systemTag">กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก</span>
                <span className="codeTag">ICODE: 1460211</span>
              </div>
              <h1>ระบบติดตามการจ่ายยาลอราทาดีน (Loratadine)</h1>
              <p>
                ตรวจสอบรายชื่อและสถิติผู้ป่วยที่ได้รับการสั่งจ่ายยาลอราทาดีนทั้งโรงพยาบาลเถินแบบเรียลไทม์ ประจำวัน
              </p>
            </div>
          </div>

          {/* Quick Stats Toolbar */}
          <div className="headerToolbar">
            <div className="refreshStatus">
              <span className="statusDot pulse"></span>
              <span className="timeLabel">อัปเดตล่าสุด: {formatTimeAgo(lastRefreshed)}</span>
            </div>
            <div className="toolbarActions">
              <label className="toggleSwitch">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <span className="switchSlider"></span>
                <span className="switchText">Auto Refresh (20s)</span>
              </label>
              <button
                type="button"
                onClick={() => fetchData(false)}
                disabled={loading || refreshing}
                className="refreshButton"
                title="รีเฟรชข้อมูลเดี๋ยวนี้"
              >
                <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
                <span>{refreshing ? 'กำลังดึงข้อมูล...' : 'รีเฟรช'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Controls & Filter Bar */}
        <section className="filterBar card animate-fadeInUp">
          <div className="filterGroup">
            {/* Age Tabs */}
            <div className="ageToggleTabs">
              <button
                type="button"
                className={`tabBtn ${ageFilter === 'adult' ? 'active' : ''}`}
                onClick={() => setAgeFilter('adult')}
              >
                <Sparkles size={16} />
                <span>เฉพาะอายุ &gt; 19 ปี (กลุ่มเป้าหมาย)</span>
              </button>
              <button
                type="button"
                className={`tabBtn ${ageFilter === 'all' ? 'active' : ''}`}
                onClick={() => setAgeFilter('all')}
              >
                <Activity size={16} />
                <span>ทุกกลุ่มอายุ (ทั้งหมด)</span>
              </button>
            </div>

            {/* Department Dropdown Filter */}
            {departments.length > 0 && (
              <div className="deptSelectWrapper">
                <Filter size={16} className="selectIcon" />
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="deptSelect"
                >
                  <option value="ALL">ทุกแผนก / จุดบริการ</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Search Box */}
          <div className="searchBoxWrapper">
            <Search size={18} className="searchIcon" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ-สกุล, HN, แผนก หรือผู้สั่งจ่าย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="searchInput"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="clearSearchBtn"
              >
                ✕
              </button>
            )}
          </div>
        </section>

        {/* Error Alert */}
        {error && (
          <div className="alertBox alertError animate-fadeIn">
            <AlertCircle size={20} />
            <div className="alertText">
              <strong>เกิดข้อผิดพลาด:</strong> {error}
            </div>
          </div>
        )}

        {/* Main Content Table Area */}
        <div className="tableCard card animate-fadeInUp">
          <div className="tableHeaderRow">
            <div className="tableTitle">
              <h3>รายชื่อผู้รับยาลอราทาดีนวันนี้</h3>
              <span className="countBadge">{filteredItems.length} รายการ</span>
            </div>
          </div>

          {loading ? (
            <div className="loadingState">
              <RefreshCw size={36} className="spinning" />
              <p>กำลังเชื่อมต่อฐานข้อมูล HOSxP และดึงข้อมูลการสั่งจ่ายยา...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="emptyState">
              <Pill size={48} className="emptyIcon" />
              <h4>ไม่พบรายการสั่งจ่ายยาลอราทาดีน</h4>
              <p>
                {searchQuery
                  ? `ไม่พบข้อมูลที่ตรงกับคำค้นหา "${searchQuery}"`
                  : 'ยังไม่มีประวัติการสั่งจ่ายยาลอราทาดีนในเงื่อนไขที่เลือกในวันนี้'}
              </p>
            </div>
          ) : (
            <div className="tableResponsive">
              <table className="dispenseTable">
                <thead>
                  <tr>
                    <th style={{ width: '90px', textAlign: 'center' }}>ประเภท</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>HN</th>
                    <th>ชื่อ - นามสกุล ผู้รับยา</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>อายุ</th>
                    <th>แผนก / จุดบริการ</th>
                    <th>แพทย์ / ผู้สั่งจ่ายยา</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>เวลาที่จ่าย</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>จำนวน (เม็ด)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => (
                    <tr key={`${item.hn}-${idx}`} className="tableRow">
                      <td style={{ textAlign: 'center' }}>
                        <span className={`statusPill statusPill--${item.status.toLowerCase()}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="hnCell" style={{ textAlign: 'center' }}>{item.hn}</td>
                      <td className="nameCell">
                        <span className="fullName">{item.fullname}</span>
                      </td>
                      <td className="ageCell" style={{ textAlign: 'center' }}>
                        <span className={`ageBadge ${item.age > 19 ? 'adultBadge' : 'minorBadge'}`}>
                          {item.age} ปี
                        </span>
                      </td>
                      <td className="deptCell">
                        <span>{item.department}</span>
                      </td>
                      <td className="doctorCell">{item.doctorName}</td>
                      <td className="timeCell" style={{ textAlign: 'center' }}>
                        <span>{item.rxtime}</span>
                      </td>
                      <td className="qtyCell" style={{ textAlign: 'center' }}>
                        <span className="qtyBadge">
                          {item.qty}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
