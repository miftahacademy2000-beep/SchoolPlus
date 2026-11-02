import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

function AuthProbe() {
  const { user, primaryRole, roles } = useAuth();

  return (
    <div>
      <span data-testid="user-email">{user?.email ?? 'no-user'}</span>
      <span data-testid="primary-role">{primaryRole ?? 'no-role'}</span>
      <span data-testid="role-count">{roles.length}</span>
    </div>
  );
}

function StudentLoginProbe() {
  const { signIn } = useAuth();
  return (
    <button onClick={() => void signIn('student-82', 'student-password')}>
      Log in as student
    </button>
  );
}

describe('AuthProvider', () => {
  it('restores the authenticated user from the saved session so protected routes stay accessible', async () => {
    api.clearToken();
    api.setToken('saved-token');

    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      user: { id: 'user-1', email: 'teacher@example.com', full_name: 'Teacher User' },
      roles: [{ id: 'role-1', role: 'teacher', school_id: 'school-1' }],
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('teacher@example.com');
      expect(screen.getByTestId('primary-role')).toHaveTextContent('teacher');
    });

    expect(getSpy).toHaveBeenCalledWith('/auth/me');
  });

  it('sends a student Login ID to backend authentication as login_id', async () => {
    api.clearToken();
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
      access_token: 'student-token',
      refresh_token: 'student-refresh',
      user: { id: 'student-1', email: 'student.82@school.local', full_name: 'Student Example' },
      roles: [{ id: 'role-1', role: 'student', school_id: 'school-1' }],
    });

    render(
      <AuthProvider>
        <StudentLoginProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Log in as student' }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/auth/login', {
        login_id: 'student-82',
        password: 'student-password',
      });
    });
  });
});
