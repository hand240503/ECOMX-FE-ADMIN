import { axiosInstance } from '../config/axiosConfig';

export interface TopProductReportDto {
  productId: number;
  productName: string;
  sku: string | null;
  count: number;
}

export interface ReportApiResponse {
  success: boolean;
  message: string;
  data: TopProductReportDto[];
  meta: any;
}

export const reportService = {
  // timeRange có thể là 'week', 'month', 'year', 'all'
  getTopSelling: (timeRange: string = 'all', limit: number = 10): Promise<ReportApiResponse> => {
    return axiosInstance.get(`/admin/reports/top-selling`, {
      params: { timeRange, limit }
    }).then(res => res.data);
  },
  
  getTopInterested: (timeRange: string = 'week', limit: number = 10): Promise<ReportApiResponse> => {
    return axiosInstance.get(`/admin/reports/top-interested`, {
      params: { timeRange, limit }
    }).then(res => res.data);
  }
};
