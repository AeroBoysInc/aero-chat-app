import { vi } from 'vitest';

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  send: vi.fn(),
  unsubscribe: vi.fn(),
};

export const supabase = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
};
