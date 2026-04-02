import { create } from 'zustand';

interface MeetingState {
  name: string;
  description: string;
  duration_type: 'short_term' | 'long_term';
  startDate?: string;
  endDate?: string;
  memberCount: number;
  upfrontDues: number;
  members: string[];
  bankInfo: {
    bank: string;
    account: string;
    holder: string;
  };
  scheduleType: 'none' | 'weekly' | 'monthly' | 'yearly';
  scheduleDay: number | null;
  setField: (field: Partial<MeetingState>) => void;
  reset: () => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  name: '',
  description: '',
  duration_type: 'short_term',
  memberCount: 2,
  upfrontDues: 0,
  members: ["", ""],
  bankInfo: { bank: '', account: '', holder: '' },
  scheduleType: 'none',
  scheduleDay: null,
  setField: (fields) => set((state) => ({ ...state, ...fields })),
  reset: () => set({
    name: '',
    description: '',
    duration_type: 'short_term',
    startDate: undefined,
    endDate: undefined,
    memberCount: 2,
    upfrontDues: 0,
    members: ["", ""],
    bankInfo: { bank: '', account: '', holder: '' },
    scheduleType: 'none',
    scheduleDay: null,
  })
}));
