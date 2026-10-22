import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LabSearchClient from '../LabSearchClient';

describe('LabSearchClient - B&W PDF & Document Print System', () => {
  const mockVisit = {
    hn: '0012345',
    cid: '1529900123456',
    ptname: 'นายทดสอบ รักษาดี',
    vn: '670101083001',
    an: null,
    dateText: '1 ม.ค. 2567',
    department: 'แผนกผู้ป่วยนอก (OPD)',
    cc: 'มีไข้ ไอ เจ็บคอ 2 วัน',
    statusName: 'ตรวจเสร็จแล้ว',
    opdDrugsCount: 2,
    opdLabsCount: 1,
    ipdDrugsCount: 0,
    ipdLabsCount: 0,
  };

  const mockDetail = {
    type: 'OPD',
    patient: {
      hn: '0012345',
      cid: '1529900123456',
      name: 'นายทดสอบ รักษาดี',
      age: 45,
      dateText: '1 ม.ค. 2567',
      diagnosis: 'J02.9 Acute pharyngitis, unspecified',
    },
    screen: {
      bps: 120,
      bpd: 80,
      bw: 65,
      height: 170,
      pulse: 78,
      temperature: 37.5,
      rr: 18,
      cc: 'มีไข้ ไอ เจ็บคอ 2 วัน',
      hpi: 'มีไข้ต่ำๆ และเจ็บคอมา 2 วัน รับประทานยาพาราเซตามอลแล้วไม่ดีขึ้น',
      pmh: 'ไม่มีโรคประจำตัว',
      department: 'แผนกผู้ป่วยนอก',
      dxMain: 'J02.9 Acute pharyngitis',
    },
    drugs: [
      {
        name: 'Paracetamol',
        strength: '500 mg',
        qty: 20,
        units: 'เม็ด',
        usage: 'รับประทานครั้งละ 1 เม็ด ทุก 4-6 ชั่วโมง เวลาปวดหรือมีไข้',
      },
      {
        name: 'Amoxicillin',
        strength: '500 mg',
        qty: 28,
        units: 'แคปซูล',
        usage: 'รับประทานครั้งละ 1 แคปซูล วันละ 4 ครั้ง ก่อนอาหารและก่อนนอน',
      },
    ],
    labs: [
      {
        formName: 'CBC & Blood Smear',
        itemName: 'WBC Count',
        result: '8,500',
        refValue: '4,500 - 10,000 /uL',
      },
    ],
    xray: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    window.print = vi.fn();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/service/lab/search')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ patients: [mockVisit] }),
        });
      }
      if (url.includes('/api/service/lab/detail')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDetail),
        });
      }
      if (url.includes('/api/log-audit')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('renders search input and allows searching for visits', async () => {
    render(<LabSearchClient />);

    const searchInput = screen.getByPlaceholderText(/กรอกเลขประจำตัวประชาชน 13 หลัก/i);
    fireEvent.change(searchInput, { target: { value: '0012345' } });

    const searchButton = screen.getByRole('button', { name: /ค้นหาข้อมูล/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('นายทดสอบ รักษาดี')).toBeInTheDocument();
      expect(screen.getByText('670101083001')).toBeInTheDocument();
    });
  });

  it('opens detail modal and presents print selection controls with initial values', async () => {
    render(<LabSearchClient />);

    // Perform search
    const searchInput = screen.getByPlaceholderText(/กรอกเลขประจำตัวประชาชน 13 หลัก/i);
    fireEvent.change(searchInput, { target: { value: '0012345' } });
    fireEvent.click(screen.getByRole('button', { name: /ค้นหาข้อมูล/i }));

    await waitFor(() => {
      expect(screen.getByText('670101083001')).toBeInTheDocument();
    });

    // Click visit VN to open detail modal
    fireEvent.click(screen.getByText('670101083001'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('เลือกส่วนพิมพ์:')).toBeInTheDocument();
    });

    // Verify 3 checkboxes exist with correct counts
    const screeningCb = screen.getByLabelText(/ซักประวัติ & สัญญาณชีพ/i) as HTMLInputElement;
    const drugsCb = screen.getByLabelText(/ยาที่ได้รับ \(2\)/i) as HTMLInputElement;
    const labsCb = screen.getByLabelText(/ผลตรวจ LAB \(1\)/i) as HTMLInputElement;

    expect(screeningCb).toBeChecked();
    expect(drugsCb).toBeChecked();
    expect(labsCb).toBeChecked();

    // Verify print button is enabled
    const printBtn = screen.getByRole('button', { name: /พิมพ์เอกสาร \(PDF\)/i });
    expect(printBtn).not.toBeDisabled();
  });

  it('disables print button when all checkboxes are unchecked', async () => {
    render(<LabSearchClient />);

    // Search and open modal
    fireEvent.change(screen.getByPlaceholderText(/กรอกเลขประจำตัวประชาชน 13 หลัก/i), {
      target: { value: '0012345' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ค้นหาข้อมูล/i }));

    await waitFor(() => {
      expect(screen.getByText('670101083001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('670101083001'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const screeningCb = screen.getByLabelText(/ซักประวัติ & สัญญาณชีพ/i);
    const drugsCb = screen.getByLabelText(/ยาที่ได้รับ/i);
    const labsCb = screen.getByLabelText(/ผลตรวจ LAB/i);
    const printBtn = screen.getByRole('button', { name: /พิมพ์เอกสาร \(PDF\)/i });

    // Uncheck all
    fireEvent.click(screeningCb);
    fireEvent.click(drugsCb);
    fireEvent.click(labsCb);

    expect(printBtn).toBeDisabled();
  });

  it('triggers window.print and dispatches audit log when print button is clicked', async () => {
    render(<LabSearchClient />);

    // Search and open modal
    fireEvent.change(screen.getByPlaceholderText(/กรอกเลขประจำตัวประชาชน 13 หลัก/i), {
      target: { value: '0012345' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ค้นหาข้อมูล/i }));

    await waitFor(() => {
      expect(screen.getByText('670101083001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('670101083001'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const printBtn = screen.getByRole('button', { name: /พิมพ์เอกสาร \(PDF\)/i });
    fireEvent.click(printBtn);

    // Verify window.print called
    expect(window.print).toHaveBeenCalledTimes(1);

    // Verify audit log POST called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/log-audit',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('พิมพ์เวชระเบียน HN: 0012345'),
      })
    );
  });

  it('renders printable document with hospital header, unmasked CID, and selected sections', async () => {
    const { container } = render(<LabSearchClient />);

    // Search and open modal
    fireEvent.change(screen.getByPlaceholderText(/กรอกเลขประจำตัวประชาชน 13 หลัก/i), {
      target: { value: '0012345' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ค้นหาข้อมูล/i }));

    await waitFor(() => {
      expect(screen.getByText('670101083001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('670101083001'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const printDoc = container.querySelector('#lab-printable-document');
    expect(printDoc).toBeInTheDocument();

    // Verify repeat layout table structure (thead for repeating patient info across all pages)
    const layoutTable = printDoc?.querySelector('.lab-print-layout-table');
    expect(layoutTable).toBeInTheDocument();

    const thead = layoutTable?.querySelector('thead');
    expect(thead).toBeInTheDocument();
    expect(thead).toHaveTextContent('โรงพยาบาลเถิน (Thoen Hospital)');
    expect(thead).toHaveTextContent('1-5299-00123-45-6');
    expect(thead).toHaveTextContent('นายทดสอบ รักษาดี');

    const tbody = layoutTable?.querySelector('tbody');
    expect(tbody).toBeInTheDocument();
    expect(tbody).toHaveTextContent('ข้อมูลการซักประวัติและสัญญาณชีพ');
    expect(tbody).toHaveTextContent('Paracetamol');
    expect(tbody).toHaveTextContent('WBC Count');

    const tfoot = layoutTable?.querySelector('tfoot');
    expect(tfoot).toBeInTheDocument();
    expect(tfoot).toHaveTextContent('พ.ร.บ. สุขภาพแห่งชาติ');
  });
});
