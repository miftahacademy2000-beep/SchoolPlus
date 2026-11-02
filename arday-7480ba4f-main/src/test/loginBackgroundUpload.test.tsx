import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthPage from '@/pages/AuthPage';
import { LoginPageDesigner } from '@/components/settings/LoginPageDesigner';
import { api } from '@/lib/api';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

const toastMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    user: null,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/usePlatformSettings', () => ({
  usePlatformSettings: vi.fn(),
}));

describe('login page image upload and rendering', () => {
  const mockUsePlatformSettings = vi.mocked(usePlatformSettings);

  beforeEach(() => {
    vi.clearAllMocks();
    toastMock.mockReset();
    mockUsePlatformSettings.mockReturnValue({
      settings: {
        login_page: {
          background_image: null,
          background_position: 'center',
          background_fit: 'cover',
          overlay_strength: 40,
          left_side_width: 50,
          show_left_side: true,
          use_gradient: true,
          gradient_start: '#1e3a8a',
          gradient_end: '#3b82f6',
          show_logo: true,
          brand_name: 'SchoolPlus',
          brand_tagline: 'Modern School Management',
        },
      },
      updateSetting: vi.fn(),
      isSaving: false,
    });
  });

  it('uploads a valid image and stores the permanent URL for the login page', async () => {
    vi.spyOn(api, 'upload').mockResolvedValue({
      data: { url: 'http://localhost:3000/uploads/platform-assets/custom-login.png' },
    } as any);

    render(<LoginPageDesigner />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'custom-login.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(api.upload).toHaveBeenCalledWith('/files/upload/platform-assets', expect.any(FormData));
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUsePlatformSettings.mock.results[0]?.value.updateSetting).toHaveBeenCalledWith(
        {
          key: 'login_page',
          value: expect.objectContaining({
            background_image: 'http://localhost:3000/uploads/platform-assets/custom-login.png',
          }),
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });

  it('shows the uploaded image as the login background when persisted settings include it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({
        data: {
          background_image: 'http://localhost:3000/uploads/platform-assets/custom-login.png',
          show_left_side: true,
          left_side_width: 50,
          use_gradient: true,
          gradient_start: '#1e3a8a',
          gradient_end: '#3b82f6',
          show_logo: true,
          brand_name: 'Custom School',
          brand_tagline: 'Modern school management',
        },
      }),
    } as any);

    const { container } = render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/platform-settings/public');
    });

    const customBackground = container.querySelector(
      'div[style*="url(http://localhost:3000/uploads/platform-assets/custom-login.png)"]',
    );

    expect(customBackground).not.toBeNull();
  });

  it('falls back to the default design when no custom image is configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ data: { background_image: null } }),
    } as any);

    const { container } = render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    expect(container.querySelector('div[style*="url(http://localhost:3000/uploads/platform-assets/"]')).toBeNull();
    expect(container.textContent).toContain('Welcome back');
  });

  it('shows an error toast when image upload fails', async () => {
    vi.spyOn(api, 'upload').mockRejectedValueOnce(new Error('Upload failed'));

    render(<LoginPageDesigner />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'bad.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Upload failed',
          variant: 'destructive',
        }),
      );
    });
  });
});
