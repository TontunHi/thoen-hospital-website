import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Navbar from '../Navbar';

const mockUsePathname = vi.fn();
const mockUseSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

describe('Navbar Component (Hallmark & Superfuture Responsive Redesign)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    
    // Default fetch mock
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/rdu')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            folders: [
              { id: 1, folder_name: 'แนวทางปฏิบัติ RDU', files: [] },
              { id: 2, folder_name: 'เอกสารเผยแพร่ RDU', files: [] }
            ]
          })
        };
      }
      if (url.includes('/api/member/me')) {
        return {
          ok: true,
          json: async () => ({
            authenticated: false,
            member: null
          })
        };
      }
      return { ok: false };
    }));
  });

  it('renders brand logo and primary core navigation links in progressive disclosure structure', () => {
    render(<Navbar />);

    // Brand Logo
    expect(screen.getByLabelText(/กลับสู่หน้าแรกโรงพยาบาลเถิน/i)).toBeInTheDocument();

    // Query specifically within primary desktop navigation
    const desktopNav = document.getElementById('primary-navigation');
    expect(desktopNav).toBeInTheDocument();

    const nav = within(desktopNav!);
    expect(nav.getByRole('link', { name: /^หน้าแรก$/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /^แพ็กเกจและบริการ$/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /^ข่าวสาร$/ })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: /^ข้อมูลองค์กรและธรรมาภิบาล$/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /^เกี่ยวกับเรา$/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /^ติดต่อเรา$/ })).toBeInTheDocument();
  });

  it('renders grouped governance dropdown cards for ITA, Ethics, RDU, and Systems', () => {
    render(<Navbar />);

    // Check items inside the Grouped Card Dropdown
    expect(screen.getByText('ธรรมาภิบาล & ความโปร่งใส')).toBeInTheDocument();
    expect(screen.getByText('ระบบ & ข้อมูลวิชาการ')).toBeInTheDocument();
    expect(screen.getByText('การประเมิน ITA')).toBeInTheDocument();
    expect(screen.getAllByText('ชมรมจริยธรรม').length).toBeGreaterThan(0);
    expect(screen.getByText('เอกสาร RDU')).toBeInTheDocument();
    expect(screen.getAllByText('ระบบสารสนเทศ').length).toBeGreaterThan(0);
  });

  it('renders check date CTA button with both full and short text for responsive screens', () => {
    render(<Navbar />);

    const checkDateBtn = screen.getByTitle('ตรวจสอบวันนัดหมายผู้ป่วย');
    expect(checkDateBtn).toBeInTheDocument();
    expect(checkDateBtn).toHaveAttribute('href', '/check-date');
    expect(checkDateBtn.querySelector('.navbar__check-date-text-full')?.textContent).toBe('ตรวจสอบวันนัดหมาย');
    expect(checkDateBtn.querySelector('.navbar__check-date-text-short')?.textContent).toBe('วันนัดหมาย');
  });

  it('toggles mobile drawer when burger menu is clicked', () => {
    render(<Navbar />);

    const burgerBtn = screen.getByLabelText(/เปิดเมนู/i);
    expect(burgerBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(burgerBtn);
    expect(burgerBtn).toHaveAttribute('aria-expanded', 'true');
    expect(burgerBtn).toHaveAttribute('aria-label', 'ปิดเมนู');
  });

  it('renders authenticated member pill when member session is active', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/member/me')) {
        return {
          ok: true,
          json: async () => ({
            authenticated: true,
            member: {
              username: '1234567890123',
              name: 'พว. วันเพ็ญ สดใส'
            }
          })
        };
      }
      return { ok: true, json: async () => ({ success: true, folders: [] }) };
    }));

    render(<Navbar />);

    await waitFor(() => {
      const names = screen.getAllByText('วันเพ็ญ');
      expect(names.length).toBeGreaterThan(0);
    });

    const desktopNav = document.getElementById('primary-navigation')!;
    const nav = within(desktopNav);
    expect(nav.getByRole('link', { name: 'ระบบงานภายใน' })).toBeInTheDocument();
  });
});
