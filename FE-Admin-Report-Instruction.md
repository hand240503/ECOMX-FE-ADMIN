# Hướng Dẫn Xây Dựng Giao Diện Báo Cáo (Report) Ở FE Admin

Tài liệu này hướng dẫn cách xây dựng trang báo cáo (Report Dashboard) trên Frontend Admin, sử dụng 2 API mới vừa được tạo:

1. `GET /api/v1/admin/reports/top-selling`
2. `GET /api/v1/admin/reports/top-interested`

## 1. Tích hợp API Service

Trong thư mục chứa các API services của FE Admin (ví dụ: `src/api/` hoặc `src/services/`), tạo một file `reportService.ts`:

```typescript
import axiosClient from './axiosClient'; // Thay thế bằng instance axios của dự án

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

export const reportApi = {
  // timeRange có thể là 'week', 'month', 'year', 'all'
  getTopSelling: (timeRange: string = 'all', limit: number = 10): Promise<ReportApiResponse> => {
    return axiosClient.get(`/admin/reports/top-selling`, {
      params: { timeRange, limit }
    });
  },

  getTopInterested: (timeRange: string = 'week', limit: number = 10): Promise<ReportApiResponse> => {
    return axiosClient.get(`/admin/reports/top-interested`, {
      params: { timeRange, limit }
    });
  }
};
```

### Ví dụ dữ liệu trả về từ API (Response JSON)

Khi gọi thành công API `getTopSelling` hoặc `getTopInterested`, kết quả JSON trả về sẽ có định dạng như sau:

```json
{
  "success": true,
  "message": "Lấy top sản phẩm bán chạy thành công",
  "data": [
    {
      "productId": 105,
      "productName": "Laptop Dell XPS 15",
      "sku": "DELL-XPS-15-2023",
      "count": 150
    },
    {
      "productId": 12,
      "productName": "Chuột Logitech MX Master 3",
      "sku": "LOGI-MX3",
      "count": 85
    }
  ],
  "meta": {
    "count": 2
  }
}
```
*Lưu ý:* Cột `count` sẽ biểu thị **số lượng đã bán** (đối với top selling) hoặc **điểm quan tâm** (đối với top interested).

## 2. Xây Dựng UI Component Báo Cáo

Tạo một trang mới cho Report, ví dụ `src/admin/pages/ReportDashboard.tsx`. Bạn có thể sử dụng thư viện biểu đồ như `recharts` hoặc `chart.js` để vẽ biểu đồ cột/tròn, hoặc dùng bảng (Table) để hiển thị danh sách.

### Cấu trúc cơ bản của trang Report:

```tsx
import React, { useState, useEffect } from 'react';
import { reportApi, TopProductReportDto } from '../../api/reportService';
// Import các component UI như Card, Select, Table, BarChart... (tuỳ thuộc vào UI framework đang dùng: Ant Design, MUI, Tailwind...)

const ReportDashboard: React.FC = () => {
  const [topSelling, setTopSelling] = useState<TopProductReportDto[]>([]);
  const [topInterested, setTopInterested] = useState<TopProductReportDto[]>([]);
  
  // States cho filter thời gian
  const [sellingTimeRange, setSellingTimeRange] = useState<string>('all');
  const [interestedTimeRange, setInterestedTimeRange] = useState<string>('week');
  
  const [loadingSelling, setLoadingSelling] = useState<boolean>(false);
  const [loadingInterested, setLoadingInterested] = useState<boolean>(false);

  // Fetch Top Selling
  useEffect(() => {
    const fetchTopSelling = async () => {
      setLoadingSelling(true);
      try {
        const res = await reportApi.getTopSelling(sellingTimeRange, 10);
        if (res.success) {
          setTopSelling(res.data);
        }
      } catch (error) {
        console.error("Lỗi khi tải top sản phẩm bán chạy", error);
      } finally {
        setLoadingSelling(false);
      }
    };
    fetchTopSelling();
  }, [sellingTimeRange]);

  // Fetch Top Interested
  useEffect(() => {
    const fetchTopInterested = async () => {
      setLoadingInterested(true);
      try {
        const res = await reportApi.getTopInterested(interestedTimeRange, 10);
        if (res.success) {
          setTopInterested(res.data);
        }
      } catch (error) {
        console.error("Lỗi khi tải top sản phẩm quan tâm", error);
      } finally {
        setLoadingInterested(false);
      }
    };
    fetchTopInterested();
  }, [interestedTimeRange]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Báo Cáo & Thống Kê</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Block 1: Top Bán Chạy */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Top Sản Phẩm Bán Chạy</h2>
            <select 
              value={sellingTimeRange}
              onChange={(e) => setSellingTimeRange(e.target.value)}
              className="border rounded p-1"
            >
              <option value="week">7 Ngày Qua</option>
              <option value="month">30 Ngày Qua</option>
              <option value="year">1 Năm Qua</option>
              <option value="all">Tất Cả</option>
            </select>
          </div>
          
          {loadingSelling ? (
            <p>Đang tải...</p>
          ) : (
            <ul>
              {topSelling.map((item, index) => (
                <li key={item.productId} className="flex justify-between py-2 border-b">
                  <span>{index + 1}. {item.productName} (SKU: {item.sku || 'N/A'})</span>
                  <span className="font-bold text-green-600">{item.count} đã bán</span>
                </li>
              ))}
              {topSelling.length === 0 && <p>Không có dữ liệu</p>}
            </ul>
          )}
        </div>

        {/* Block 2: Top Quan Tâm */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Top Sản Phẩm Được Quan Tâm</h2>
            <select 
              value={interestedTimeRange}
              onChange={(e) => setInterestedTimeRange(e.target.value)}
              className="border rounded p-1"
            >
              <option value="week">7 Ngày Qua</option>
              <option value="month">30 Ngày Qua</option>
              <option value="year">1 Năm Qua</option>
            </select>
          </div>
          
          {loadingInterested ? (
            <p>Đang tải...</p>
          ) : (
            <ul>
              {topInterested.map((item, index) => (
                <li key={item.productId} className="flex justify-between py-2 border-b">
                  <span>{index + 1}. {item.productName} (SKU: {item.sku || 'N/A'})</span>
                  <span className="font-bold text-blue-600">{item.count} điểm</span>
                </li>
              ))}
              {topInterested.length === 0 && <p>Không có dữ liệu</p>}
            </ul>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default ReportDashboard;
```

## 3. Khai báo Route
Vào file cấu hình routing (ví dụ: `src/routes/index.tsx` hoặc `App.tsx`), thêm route cho component `ReportDashboard`.

```tsx
<Route path="/admin/reports" element={<ReportDashboard />} />
```

Thêm menu mục "Báo cáo" trong thanh Sidebar của Admin để user có thể click chuyển trang.

## 4. Trực Quan Hóa Bằng Biểu Đồ (Optional)
Khuyến khích sử dụng thư viện `recharts`. Bạn có thể truyền data `topSelling` và `topInterested` thẳng vào `<BarChart data={topSelling}>` để vẽ biểu đồ cột thể hiện tương quan giữa các sản phẩm thay vì chỉ dùng danh sách đơn thuần.
