import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Navbar from '../Navbar';

const mockUsePathname = vi.fn();
const mockUseSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

describe('Navbar Component (Option A: Clinical Single-Bar & Unified Directory)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUsePathname.mockReturnValue('/');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/rdu')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              folders: [
                { id: 1, folder_name: 'แนวทางปฏิบัติ RDU', files: [] },
                { id: 2, folder_name: 'เอกสารเผยแพร่ RDU', files: [] },
              ],
            }),
          };
        }
        if (url.includes('/api/member/me')) {
          return {
            ok: true,
            json: async () => ({
              authenticated: false,
              member: null,
            }),
          };
        }
        return { ok: false };
      })
    );
  });

  it('renders brand logo and concise core navigation items', async () => {
    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getByText('แนวทางปฏิบัติ RDU')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/กลับสู่หน้าแรกโรงพยาบาลเถิน/i)).toBeInTheDocument();

    const desktopNav = document.getElementById('primary-navigation');
    expect(desktopNav).toBeInTheDocument();

    const nav = within(desktopNav!);
    expect(nav.getByRole('link', { name: /^หน้าแรก$/ })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: /^บริการ$/ })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: /^ข่าวสาร$/ })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: /^ธรรมาภิบาล$/ })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: /^เกี่ยวกับเรา$/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /^ติดต่อเรา$/ })).toBeInTheDocument();
  });

  it('toggles dropdown popovers via accessible button triggers and closes on Escape', async () => {
    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getByText('แนวทางปฏิบัติ RDU')).toBeInTheDocument();
    });

    const desktopNav = document.getElementById('primary-navigation')!;
    const servicesBtn = within(desktopNav).getByRole('button', { name: /^บริการ$/ });
    expect(servicesBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(servicesBtn);
    expect(servicesBtn).toHaveAttribute('aria-expanded', 'true');
    expect(within(desktopNav).getByRole('link', { name: /ดูแพ็กเกจและบริการทั้งหมด/ })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(servicesBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders unified governance directory items for ITA, Ethics, RDU, and Systems', async () => {
    render(<Navbar />);

    expect(screen.getByText('ธรรมาภิบาลและความโปร่งใส')).toBeInTheDocument();
    expect(screen.getByText('ระบบและข้อมูลวิชาการ')).toBeInTheDocument();
    expect(screen.getByText('การประเมิน ITA')).toBeInTheDocument();
    expect(screen.getAllByText('ชมรมจริยธรรม').length).toBeGreaterThan(0);
    expect(screen.getByText('เอกสาร RDU')).toBeInTheDocument();
    expect(screen.getAllByText('ระบบสารสนเทศ').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText('แนวทางปฏิบัติ RDU')).toBeInTheDocument();
    });
  });

  it('renders primary appointment check button and quiet login button', async () => {
    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getByText('แนวทางปฏิบัติ RDU')).toBeInTheDocument();
    });

    const checkDateBtn = screen.getByTitle('ตรวจสอบวันนัดหมายผู้ป่วย');
    expect(checkDateBtn).toBeInTheDocument();
    expect(checkDateBtn).toHaveAttribute('href', '/check-date');
    expect(checkDateBtn).toHaveTextContent('ตรวจสอบวันนัดหมาย');

    const loginBtn = screen.getByTitle('เข้าสู่ระบบสมาชิก');
    expect(loginBtn).toHaveAttribute('href', '/member/login');
    expect(loginBtn).toHaveTextContent('เข้าสู่ระบบ');
  });

  it('toggles mobile drawer when burger menu is clicked', async () => {
    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getByText('แนวทางปฏิบัติ RDU')).toBeInTheDocument();
    });

    const burgerBtn = screen.getByLabelText(/เปิดเมนู/i);
    expect(burgerBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(burgerBtn);
    expect(burgerBtn).toHaveAttribute('aria-expanded', 'true');
    expect(burgerBtn).toHaveAttribute('aria-label', 'ปิดเมนู');
  });

  it('renders authenticated member chip with Thai honorific-stripped initials and staff link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/member/me')) {
          return {
            ok: true,
            json: async () => ({
              authenticated: true,
              member: {
                username: '1234567890123',
                name: 'พว. วันเพ็ญ สดใส',
              },
            }),
          };
        }
        return { ok: true, json: async () => ({ success: true, folders: [] }) };
      })
    );

    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getAllByText('วันเพ็ญ').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('วั').length).toBeGreaterThan(0);

    const desktopNav = document.getElementById('primary-navigation')!;
    expect(within(desktopNav).getByRole('link', { name: 'ระบบงานภายใน' })).toBeInTheDocument();
  });

  it('renders uploaded member profile photo and falls back to initials when image fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/member/me')) {
          return {
            ok: true,
            json: async () => ({
              authenticated: true,
              member: {
                id: 42,
                username: '1234567890123',
                name: 'พว. วันเพ็ญ สดใส',
                hasProfileImage: true,
              },
            }),
          };
        }
        return { ok: true, json: async () => ({ success: true, folders: [] }) };
      })
    );

    const { container } = render(<Navbar />);

    await waitFor(() => {
      const avatarImages = container.querySelectorAll('img.navbar__member-avatar-img');
      expect(avatarImages.length).toBe(2);
      expect(avatarImages[0]).toHaveAttribute('src', '/api/member/profile/image?userId=42');
    });

    const firstAvatarImg = container.querySelector('img.navbar__member-avatar-img')!;
    fireEvent.error(firstAvatarImg);

    await waitFor(() => {
      expect(container.querySelectorAll('img.navbar__member-avatar-img').length).toBe(0);
      expect(screen.getAllByText('วั').length).toBeGreaterThan(0);
    });
  });

  it('closes mobile drawer automatically when window is resized to desktop width (>1024px)', async () => {
    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getByText('แนวทางปฏิบัติ RDU')).toBeInTheDocument();
    });

    const burgerBtn = screen.getByLabelText(/เปิดเมนู/i);
    fireEvent.click(burgerBtn);
    expect(burgerBtn).toHaveAttribute('aria-expanded', 'true');

    window.innerWidth = 1280;
    fireEvent(window, new Event('resize'));

    expect(burgerBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders nothing on tv-mode routes', async () => {
    mockUsePathname.mockReturnValue('/service/er-in-status/tv-mode');
    const { container } = render(<Navbar />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
