export interface ApiError {
  statusCode?: number;
  message: string;
  error?: string;
  details?: Array<{
    path?: string;
    message: string;
  }>;
}
