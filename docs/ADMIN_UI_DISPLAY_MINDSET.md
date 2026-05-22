# Tư duy hiển thị Admin — sản phẩm & chương trình giá

Tài liệu mô tả **cách tổ chức giao diện quản trị** sao cho khớp mô hình dữ liệu backend (SPU / SKU, chương trình theo sản phẩm hay theo phân loại). Không thay thế tài liệu API chi tiết; tham chiếu thêm: [`ADMIN_PRODUCT_CREATE_UPDATE.md`](ADMIN_PRODUCT_CREATE_UPDATE.md), [`CHECKOUT_ORDER_PRICING_UI.md`](CHECKOUT_ORDER_PRICING_UI.md), [`ADMIN_PURCHASE_WITH_PURCHASE.md`](ADMIN_PURCHASE_WITH_PURCHASE.md).

---

## 1. Hai lớp: SPU và phân loại (SKU)

| Khái niệm | Backend | Gợi ý hiển thị admin |
|-----------|---------|----------------------|
| **Sản phẩm (SPU)** | `ProductFullResponse.id`, tên, danh mục, hãng, ảnh SP, tag, `sku` (số tổng quát nếu có) | Trang **tổng quan SP**: tên, danh mục/hãng, trạng thái, cờ nổi bật/hot, gallery chung. |
| **Phân loại / biến thể (SKU)** | `ProductVariantResponse`: `id`, `skuCode`, `optionValues`, giá theo đơn vị, `effective_unit_price`, `active_price_change` | Luôn có **bảng hoặc accordion “Phân loại”**: mỗi dòng = một `variant.id`; đừng nhầm với nhãn “SKU” hiển thị nếu nó là `skuCode` hoặc số `sku` SP. |

**Nguyên tắc:** Mọi thao tác **đặt hàng / giỏ / giá KM theo dòng đơn** đều bám **`product_variant_id`**. Form admin khi chọn “sản phẩm” cho PwP, price change, v.v. nên **hiện rõ**: tên SP + **mã phân loại + ID variant** (như màn bạn mô tả: `IP16PM-256-BLACK-UNL-NEW (ID 2)`).

---

## 2. Màn sản phẩm: nhóm field và partial update

### 2.1 Tạo mới

- **Thông tin chung (SP):** tên, mô tả ngắn/dài, danh mục (bắt buộc), hãng (tuỳ chọn), trạng thái, SKU số (tuỳ), tag, cờ featured/hot.
- **Phân loại & giá:** hoặc nhiều variant kèm giá, hoặc một cụm `prices` đơn giản (server tạo variant mặc định).

Hiển thị: hai block rõ ràng — **“Thông tin sản phẩm”** vs **“Phân loại & giá”** — tránh trộn một giá “chung” không gắn SKU khi đã có nhiều phân loại.

### 2.2 Sửa

Backend là **partial update**: chỉ gửi field thay đổi (trừ mảng thao tác giá/xóa biến thể có ý định rõ). UI nên:

- Tab/form tách **SP** và **SKU**; khi user chỉ sửa tên → không đụng payload variant.
- **Danh mục / hãng:** select lấy từ API danh mục & hãng; value submit = `id`.
- **Cập nhật có ảnh:** luồng multipart (`product` + `newImages`); trong JSON gắn `removedDocumentIds`, `mainDocumentId`, `mainNewImageIndex` khi cần.

Chi tiết field: xem [`ADMIN_PRODUCT_CREATE_UPDATE.md`](ADMIN_PRODUCT_CREATE_UPDATE.md).

---

## 3. Danh mục & hãng trên form

- **Danh mục:** cây cha–con; label cho user, value = `CategoryResponse.id`. Có cảnh báo khi PUT danh mục chỉ sửa field khác: nên gửi lại `parentId` hiện tại nếu API category dùng partial (tránh làm đổi nhầm cây).
- **Hãng:** danh sách đơn giản; optional trên tạo SP; partial trên sửa (không gửi = giữ nguyên).

---

## 4. Chương trình giá — phân tầng hiển thị

Cùng một SP trên API chi tiết có thể có đồng thời nhiều loại chương trình; **mỗi loại gắn đúng cấp** (SPU vs variant):

| Chương trình | Gắn cấp nào | Gợi ý admin / storefront |
|-------------|-------------|---------------------------|
| **Price change (PC)** | Theo **variant** (`active_price_change` trên từng SKU) | Trên bảng phân loại: cột “Giá ưu đãi / khung thời gian PC”; có thể link sang màn quản lý PC theo variant. |
| **Mix & match (bậc SL)** | Theo **từng variant** — `volume_price_tiers` trên `ProductVariantResponse` | Trên **bảng phân loại**: mỗi SKU có bậc riêng; gọi API admin `…/variants/{variantId}/volume-price-tiers`. Trên đơn, bậc chọn theo **tổng SL đúng SKU** (`aggregate_quantity_for_variant_on_order`). |
| **PwP (mua kèm)** | **Bắt buộc** neo & đi kèm là **hai variant** cụ thể (`anchor_variant_id`, `companion_variant_id`) | Picker SP + **chọn phân loại** cho cả neo và đi kèm; không còn chế độ “áp cả SPU”. |

**Tư duy chung:**  
- Muốn biết **giá một SKU** sau PC → nhìn variant.  
- Muốn biết **bậc mix** → nhìn **variant** (`volume_price_tiers` từng SKU; snapshot `aggregate_quantity_for_variant_on_order`).  
- Muốn biết **ai neo / ai đi kèm** → đọc `purchase_with_purchase_programs[].role` + id SP/variant.

Đơn hàng / preview checkout: snapshot chi tiết từng dòng trong `pricing_programs` — xem [`CHECKOUT_ORDER_PRICING_UI.md`](CHECKOUT_ORDER_PRICING_UI.md).

---

## 5. Màn quản trị PwP — cách nghĩ cho UI

1. **Chọn neo / đi kèm:** mỗi vai trò = **một phân loại (variant)** — gửi `anchorProductId` + `anchorVariantId`, `companionProductId` + `companionVariantId` (variant **bắt buộc**); id SP và id variant phải khớp.
2. **Một variant đi kèm** chỉ có **tối đa một** chương trình PwP bật theo unique backend.
3. **Giá KM / min neo / tỉ lệ / trần:** giữ một block số như form nghiệp vụ.
4. **Danh sách offer:** mỗi dòng: neo / đi kèm (tên SP + phân loại + `variant.id`).

Chi tiết request/API: [`ADMIN_PURCHASE_WITH_PURCHASE.md`](ADMIN_PURCHASE_WITH_PURCHASE.md).

---

## 6. Quyền (định hướng menu admin)

Gợi ý gom menu theo nhóm quyền backend (số chỉ mang tính tham chiếu; đúng theo `PermissionCode` trong code):

- Sản phẩm: đọc/ghi/xóa SP (vd. 100002 / 100001 / 100003 / 100004).  
- Danh mục: CRUD riêng (module ~200xxx).  
- Giá / khuyến mãi gắn giá (PC, PwP, có thể cả volume tier): thường nhóm ~150xxx.  

Ẩn nút “Tạo / Sửa” khi JWT không có đúng permission; chỉ hiện “Xem” khi chỉ có READ.

---

## 7. Checklist UX nhanh

- [ ] Luôn hiển thị **`variant.id`** ở nơi chọn phân loại quan trọng (PwP, PC, dòng đơn).  
- [ ] Phân biệt nhãn **SKU hiển thị** vs **id DB** trong copy/tooltip.  
- [ ] SP có nhiều variant: không để một ô “giá” duy nhất mơ hồ mà không gắn SKU.  
- [ ] Chương trình **mix & match** và **PwP** đều cấu hình **theo SKU** (màn admin gắn `variantId`).  
- [ ] Chương trình theo SKU đặt trong **bảng phân loại** hoặc URL API có `variantId`.  
- [ ] Sau đặt hàng: ưu tiên đọc **snapshot** `pricing_programs` thay vì suy luận lại từ catalog.

---

*Tài liệu phản ánh tư duy hiển thị đồng bộ với `ProductFullResponse`, `ProductVariantResponse`, các DTO chương trình giá và luồng admin hiện tại trong codebase.*
