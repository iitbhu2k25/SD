export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  meta?: Record<string, any>;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
}