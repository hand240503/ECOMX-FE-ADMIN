# Admin: tạo và cập nhật sản phẩm

Tài liệu cho màn **thêm / sửa sản phẩm** qua API admin. Base path:

`{api.prefix}/admin/products`

Giá trị `{api.prefix}` lấy từ cấu hình Spring (`api.prefix` trong profile đang chạy), ví dụ `/api/v1` — cần đối chiếu file cấu hình môi trường thực tế.

## Ví dụ dữ liệu mẫu — điền form admin

Dùng để **test màn thêm/sửa sản phẩm**: copy hoặc bắt chước theo; **danh mục / hãng / đơn vị tính** phải chọn (hoặc tạo trước) đúng với dữ liệu thật trong DB, không cần trùng số id với ví dụ API phía dưới.

### Form “Thêm sản phẩm”

| Ô / nhóm trên form | Gợi ý nhập |
|--------------------|------------|
| Tên sản phẩm | `Tai nghe không dây Sony WH-1000XM5` |
| Mô tả ngắn | `Chống ồn chủ động ANC, pin tới ~30 giờ, kết nối đa điểm.` |
| Mô tả dài (HTML) | `<p>Âm thanh Hi-Res, nhiều chế độ nghe môi trường. Bảo hành 12 tháng.</p>` |
| Danh mục | Chọn **Âm thanh** (hoặc danh mục con bạn đã có, VD: *Điện tử → Tai nghe*). |
| Hãng | Chọn **Sony** (nếu đã có trong danh sách hãng). |
| Trạng thái | `1` — nếu form map theo nghiệp vụ đội bạn (VD: 1 = đang bán). |
| SKU (số) | `100001` |
| Nổi bật | Bật (hoặc Tùy layout). |
| Hot sale | Tắt |
| **Biến thể 1** — Mã SKU | `WH1000XM5-BK` |
| Thuộc tính (tùy form) | Màu: `Đen` |
| **Giá** — Đơn vị | Chọn **Cái** (hoặc đơn vị đã khai báo, VD id `1`). |
| Giá bán hiện tại | `7490000` |
| Giá niêm yết / gốc | `8490000` |

**Trường hợp chỉ một mức giá không tách biến thể:** có thể không thêm dòng biến thể, chỉ nhập khối giá gốc với cùng `unit_id` / giá như trên (backend sẽ tạo một biến thể mặc định nếu nghiệp vụ cho phép).

### Form “Sửa sản phẩm” (vài ô hay đổi)

| Ô | Gợi ý |
|---|--------|
| Tên | Thêm hậu tố test, VD: `Tai nghe không dây Sony WH-1000XM5 — bản demo` |
| Tag | `flash-sale` |
| Hot sale | Bật |
| Danh mục / Hãng | Chọn lại chỉ khi cần đổi nhóm |

### Gợi ý nếu cần tạo **danh mục** trước (màn Danh mục)

| Trường | Mẫu 1 | Mẫu 2 |
|--------|--------|--------|
| Mã (`code`) | `PHONE` | `AUDIO` |
| Tên | `Điện thoại` | `Âm thanh` |
| Trạng thái | `1` | `1` |
| Danh mục cha | *(trống — gốc)* | Có thể chọn *Điện tử* nếu đã có |

---


## Xác thực và quyền

- Gửi **JWT** (Bearer) như các API admin khác.
- Quyền kiểm tra qua `@PreAuthorize` / `PermissionCode` số:
  - **Tạo sản phẩm** `POST …/admin/products`: quyền **100001**
  - **Đọc** (chi tiết, danh sách, …): **100002**
  - **Cập nhật** `PUT …/admin/products/{id}`: **100003**
  - **Xóa**: **100004**

---

## Danh mục (category)

### Liên quan tạo / cập nhật sản phẩm

| Thao tác | `categoryId` | Hành vi backend |
|----------|--------------|------------------|
| **Tạo** (`POST …/admin/products`) | **Bắt buộc** | Phải là id danh mục đã tồn tại; sai id → lỗi (vd. không tìm thấy category). |
| **Sửa** (`PUT …/admin/products/{id}`) | **Tùy chọn** (partial) | Chỉ khi body **có** `categoryId` thì đổi sang danh mục mới. **Không gửi** `categoryId` → giữ nguyên danh mục hiện tại. Mỗi sản phẩm luôn gắn một danh mục (không có luồng “bỏ category”). |

Form admin chọn danh mục nên lấy danh sách từ API danh mục bên dưới, bind **id** vào `categoryId` khi gọi tạo/sửa sản phẩm.

### API quản trị danh mục

Base: **`{api.prefix}/admin/categories`** (JWT). Quyền (`PermissionCode`):

| Quyền | Mã | Dùng cho |
|--------|-----|----------|
| CREATE_CATEGORY | **200001** | `POST` |
| READ_CATEGORY | **200002** | `GET` |
| UPDATE_CATEGORY | **200003** | `PUT` |
| DELETE_CATEGORY | **200004** | `DELETE` |

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/admin/categories` | Danh sách danh mục (cấu trúc cha–con qua `children` trong từng phần tử). |
| `GET` | `/admin/categories/{id}` | Một danh mục theo id. |
| `POST` | `/admin/categories` | Tạo danh mục. Body: `CreateCategoryRequest`. |
| `PUT` | `/admin/categories/{id}` | Cập nhật. Body: `UpdateCategoryRequest` (partial). |
| `DELETE` | `/admin/categories/{id}` | Xóa. |

### `CategoryResponse` (thường nằm trong `APIResponse.data`)

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | number | Dùng làm `categoryId` khi gọi API sản phẩm. |
| `code` | string | Mã danh mục. |
| `name` | string | Tên hiển thị. |
| `status` | number | |
| `parentId` | number | Danh mục cha (nếu có). |
| `parentName` | string | |
| `children` | array | Danh mục con (`CategoryResponse` lồng nhau). |
| `childrenCount` | number | |

### Tạo / sửa danh mục (tóm tắt body)

**`POST` — `CreateCategoryRequest`**

| Trường | Bắt buộc | Ghi chú |
|--------|----------|---------|
| `code` | Có | |
| `name` | Có | |
| `status` | Có | |
| `parentId` | Không | Gắn làm danh mục con của `parentId`. |

**`PUT` — `UpdateCategoryRequest`** (field có trong body mới áp vào entity)

| Trường | Ghi chú |
|--------|---------|
| `code`, `name`, `status` | Partial: có giá trị mới thì đổi. |
| `parentId` | Gửi id danh mục cha để đổi cha. Trong `CategoryServiceImpl`, `parentId == null` được xử lý kèm điều kiện trên entity hiện tại; **khi gọi PUT chỉ sửa các field khác** (vd. chỉ `name`), nên **gửi kèm `parentId` đang có** (hoặc id cha mong muốn) để không vô tình làm đổi cây cha–con. |

---

## 1. Tạo sản phẩm

**`POST`** `{api.prefix}/admin/products`  
**`Content-Type`:** `application/json`

### Body: `CreateProductRequest`

| Trường | Kiểu | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| `productName` | string | Có | |
| `categoryId` | number | Có | Phải tồn tại |
| `brandId` | number | Không | Hãng; phải tồn tại nếu gửi |
| `description` | string | Không | |
| `l_description` | string | Không | Mô tả dài / rich-text (JSON key snake cho property Java) |
| `status` | number | Không | |
| `sku` | number | Không | SKU dạng số trên sản phẩm |
| `isFeatured` | boolean | Không | Mặc định `false` nếu không gửi |
| `hotSale` | boolean | Không | Mặc định `false` nếu không gửi |
| `variants` | array | Không | Danh sách biến thể + giá (xem bên dưới) |
| `prices` | array | Không | Chỉ dùng khi **không** gửi `variants` (hoặc rỗng): hệ thống tạo **một biến thể mặc định** và gắn các dòng giá này |

Nếu không gửi `variants` và không gửi `prices`, server tạo **một biến thể mặc định** (không giá).

### `variants[]` — `CreateProductVariantRequest`

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| `skuCode` | string | SKU chuỗi (khuyến nghị unique) |
| `optionValues` | object | Map key-value (VD: `{ "Màu": "Đen", "ROM": "256GB" }`) |
| `active` | boolean | |
| `sortOrder` | number | |
| `prices` | array | `CreatePriceRequest` (xem bảng giá) |

### Giá — `CreatePriceRequest` (trong `prices` hoặc trong từng variant)

| Trường (JSON) | Kiểu | Bắt buộc |
|---------------|------|----------|
| `unit_id` | number | Có |
| `current_value` | number | Có |
| `old_value` | number | Không |

### Ví dụ JSON — tạo SP có một biến thể + giá

```json
{
  "productName": "Điện thoại X",
  "categoryId": 1,
  "brandId": 3,
  "description": "Mô tả ngắn",
  "l_description": "<p>Mô tả dài</p>",
  "status": 1,
  "sku": 88001234,
  "isFeatured": false,
  "hotSale": true,
  "variants": [
    {
      "skuCode": "X-BLACK-128",
      "optionValues": { "Màu": "Đen", "Bộ nhớ": "128GB" },
      "active": true,
      "sortOrder": 0,
      "prices": [
        { "unit_id": 1, "current_value": 12990000, "old_value": 14990000 }
      ]
    }
  ]
}
```

### Ví dụ — chỉ dùng `prices` gốc (một variant mặc định)

```json
{
  "productName": "Phụ kiện Y",
  "categoryId": 2,
  "brandId": 5,
  "prices": [
    { "unit_id": 1, "current_value": 290000, "old_value": 350000 }
  ]
}
```

### Response

- **201 Created** khi thành công; `data` là `ProductFullResponse`.
- **400** khi lỗi validation / nghiệp vụ (message trong `errors`).

---

## 2. Cập nhật sản phẩm (JSON)

**`PUT`** `{api.prefix}/admin/products/{id}`  
**`Content-Type`:** `application/json`

Cập nhật **theo từng field có trong body** (partial): field không gửi thì **giữ nguyên** giá trị hiện tại (trừ các mảng thao tác giá/biến thể/ảnh — xem ghi chú dưới).

### Body: `UpdateProductRequest` — trường văn bản / danh mục / hãng

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| `productName` | string | |
| `description` | string | |
| `l_description` | string | |
| `status` | number | |
| `categoryId` | number | Đổi danh mục; phải tồn tại |
| `brandId` | number | Đổi hãng; phải tồn tại. **Không gửi** → không đổi hãng |
| `isFeatured` | boolean | |
| `hotSale` | boolean | |
| `sku` | number | Partial |
| `tag` | string | Có thể gửi `""` để xóa tag |

### Ảnh / document (cấp sản phẩm)

Chỉ áp dụng document thuộc đúng sản phẩm đang sửa.

| Trường | Ghi chú |
|--------|---------|
| `removedDocumentIds` | Danh sách id document cần xóa |
| `mainDocumentId` | Sau khi xóa/thêm: đặt ảnh đại diện (phải thuộc SP) |
| `mainNewImageIndex` | Chỉ dùng kèm **multipart** `newImages`: chỉ số 0-based của file mới làm main; ưu tiên thấp hơn `mainDocumentId` nếu cả hai có |

Với **chỉ JSON** (không upload file): dùng `removedDocumentIds` / `mainDocumentId` trên document đã có. Upload file mới trong luồng này cần **PUT multipart** (mục 3).

### Giá & biến thể (tóm tắt)

| Trường | Ý nghĩa |
|--------|---------|
| `newPrices` | Thêm dòng giá (schema `CreatePriceRequest`) — tương thích legacy: gắn vào biến thể “chính” |
| `updatedPrices` | Sửa giá đã có; mỗi phần tử: `id` bắt buộc, `unit_id`, `current_value`, `old_value` (`UpdateProductPriceItemRequest`) |
| `removedPriceIds` | Xóa các bản ghi price theo id |
| `newVariants` | Thêm biến thể mới (`CreateProductVariantRequest`) |
| `updatedVariants` | Sửa biến thể: `id` bắt buộc; có thể kèm `newPrices`, `updatedPrices`, `removedPriceIds`, `removedDocumentIds`, `mainDocumentId` (`UpdateProductVariantItemRequest`) |
| `removedVariantIds` | Xóa biến thể theo id |

Chi tiết nested:

- **`UpdateProductPriceItemRequest`:** `id`, `unit_id` (optional), `current_value`, `old_value`.
- **`UpdateProductVariantItemRequest`:** `id`, `skuCode`, `optionValues`, `active`, `sortOrder`, `newPrices`, `updatedPrices`, `removedPriceIds`, `removedDocumentIds`, `mainDocumentId`.

### Ví dụ — chỉ đổi tên + hãng + tag

```json
{
  "productName": "Tên mới",
  "brandId": 2,
  "tag": "sale"
}
```

### Response

- **200** + `ProductFullResponse` trong `data`.
- **404** nếu không tìm thấy sản phẩm / thực thể liên quan.
- **4xx** khác tùy `CustomApiException` (chi tiết trong `message` / `errors`).

---

## 3. Cập nhật sản phẩm kèm upload ảnh

**`PUT`** `{api.prefix}/admin/products/{id}`  
**`Content-Type`:** `multipart/form-data`

| Part | Kiểu | Bắt buộc |
|------|------|----------|
| `product` | string (JSON) | Có — nội dung giống `UpdateProductRequest`, serialize thành chuỗi JSON |
| `newImages` | file | Không — lặp lại cùng tên field cho nhiều file |

Trong JSON `product` có thể set `removedDocumentIds`, `mainDocumentId`, `mainNewImageIndex` như mục 2.

---

## 4. Gói response chung `APIResponse`

Các endpoint trên trả về envelope kiểu:

- `success` (boolean)
- `message` (string)
- `data` — thường là `ProductFullResponse` khi thành công
- `errors` — mảng lỗi chi tiết (khi `success: false`)
- `metadata` — có thể có (vd. phân trang không dùng cho PUT/POST này)
- `timestamp` — tùy cấu hình

---

## 5. Gợi ý cho FE admin

1. **Danh mục:** dùng `GET …/admin/categories` (quyền đọc danh mục **200002**) để build cây/select; giá trị submit là `id` → `categoryId`. Chi tiết mục **Danh mục (category)** ở trên. **Hãng / đơn vị:** tương tự từ `/admin/brands`, `/admin/units`.
2. **Tạo SP:** quyết định một trong hai: form **nhiều biến thể** (`variants`) hoặc **một mức giá** đơn giản (`prices` không kèm `variants`).
3. **Sửa SP:** gửi tối thiểu các field user đã thay đổi để tránh ghi đè nhầm; lưu ý mảng `updatedPrices` / `removedPriceIds` chỉ gửi khi thật sự thao tác giá.
4. **Hãng:** `brandId` tạo SP là tùy chọn; cập nhật SP chỉ đổi hãng khi body có `brandId` — hiện **không** hỗ trợ xóa hãng (set null) qua một flag riêng trong API này.

---

*Tài liệu căn cứ mã nguồn: `AdminProductController`, `AdminCategoryController`, `CreateProductRequest`, `UpdateProductRequest`, `CategoryResponse`, `CreateCategoryRequest`, `UpdateCategoryRequest` và các DTO giá/biến thể liên quan.*
