import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClinicalRecovery from '../components/clinical-rag/ClinicalRecovery.jsx';

// Mock the framer-motion library 
vi.mock('framer-motion', () => {
    return {
        motion: {
            div: ({ children }) => <div>{children}</div>,
            button: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
            span: ({ children }) => <span>{children}</span>,
            p: ({ children }) => <p>{children}</p>,
        },
        AnimatePresence: ({ children }) => children,
    }
});

// mock pythonApi.ragProtocol
vi.mock('../../services/api.js', () => ({
  pythonApi: {
    ragProtocol: vi.fn().mockResolvedValue({ success: true, protocol: 'Mocked protocol content' }),
  }
}));

describe('ClinicalRecovery', () => {
  it('renders intake warning when user profile is missing', () => {
    render(<ClinicalRecovery userProfile={null} />);
    expect(screen.getByText(/Please complete the intake/i)).toBeInTheDocument();
  });

  it('renders clinical recovery header when user profile is provided', () => {
    const mockProfile = {
      profileId: 'anxiety',
      severity: 'moderate',
      baselineArousalScore: 5
    };
    render(<ClinicalRecovery userProfile={mockProfile} />);
    expect(screen.getByText(/Clinical Recovery Protocol/i)).toBeInTheDocument();
    expect(screen.getByText(/tailored for your anxiety profile/i)).toBeInTheDocument();
  });
});
