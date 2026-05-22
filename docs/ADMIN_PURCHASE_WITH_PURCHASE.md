# Admin: chương trình mua kèm (Purchase-with-Purchase, PwP)

Khi khách có **sản phẩm neo** (anchor) trên đơn đủ điều kiện, một phần số lượng **sản phẩm đi kèm** (companion) được tính theo **đơn giá khuyến mãi** đã cấu hình.

**Base path:** `{api.prefix}/admin/promotions/purchase-with-purchase`  
**JWT** bắt buộc. Quyền gắn với nhóm giá (`PermissionCode`):

| Thao tác | Method | Quyền (mã) |
|----------|--------|------------|
| Danh sách | `GET` / | **150002** (`READ_PRICE`) |
| Tạo | `POST` / | **150001** (`CREATE_PRICE`) |
| Sửa | `PUT /{id}` | **150003** (`UPDATE_PRICE`) |
| Xóa | `DELETE /{id}` | **150004** (`DELETE_PRICE`) |

**Lưu ý xóa:** backend chỉ cho phép xóa khi offer **đang tắt** (`enabled: false`).

---

## Body tạo / sửa: `UpsertPurchaseWithPurchaseRequest`

Tên field JSON (camelCase) đúng theo class Java.

| Trường | Kiểu | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| `anchorProductId` | number | Có | Id SPU neo (`products.id`); phải trùng SPU của `anchorVariantId`. |
| `companionProductId` | number | Có | Id SPU đi kèm; phải trùng SPU của `companionVariantId`. |
| `anchorVariantId` | number | Có | Phân loại neo (`product_variant.id`); chỉ SL đúng SKU này được tính làm neo. |
| `companionVariantId` | number | Có | Phân loại đi kèm nhận giá KM; **mỗi companion variant** tối đa **một** PwP. |
| `promoUnitPrice` | number | Có | Đơn giá KM cho companion (VND). Cho phép `0` (miễn phí / đồng giá 0). `@Min(0)`. |
| `minAnchorQuantity` | number | Không | SL tối thiểu neo trên đơn để kích hoạt. Mặc định **1** nếu không gửi. `@Min(1)` nếu gửi. |
| `companionPromoUnitsPerAnchor` | number | Không | Số đơn vị đi kèm được giá KM **trên mỗi “bộ” neo đủ điều kiện** (tỉ lệ). Mặc định **1**. `@Min(1)` nếu gửi. Ví dụ `2`: cứ đủ điều kiện neo thì tối đa 2 đơn vị companion trên đơn được tính giá KM (trong giới hạn tổng SL và `maxCompanionPromoUnits`). |
| `maxCompanionPromoUnits` | number | Không | Trần tổng số đơn vị companion được giá KM **trên một đơn**. **`null` / bỏ field = không giới hạn**. `@Min(1)` nếu gửi. |
| `enabled` | boolean | Không | Mặc định **true** khi tạo. Bật/tắt hiệu lực. |

`anchorProductId` và `companionProductId` **phải khác nhau** (400 nếu trùng).

**Nguồn id sản phẩm:** dùng `GET {api.prefix}/admin/products/...` hoặc chi tiết SP — lấy **`id`** trong `ProductFullResponse`, không nhầm với trường `sku` (số SKU) nếu UI chỉ hiển thị “SKU 100001”.

---

## Ví dụ 1 — Đúng như form mẫu (neo iPhone 16 Pro Max, đi kèm ốp, giá KM 0 đồng)

Diễn giải UI:

- Sản phẩm neo: *iPhone 16 Pro Max* · hiển thị “SKU 100001”
- Đi kèm: *Ốp lưng iPhone 16 Pro Max Likgus PC* · “SKU 100538”
- Đơn giá KM: **0** VNĐ
- SL tối thiểu neo: **1**
- Đơn vị đi kèm KM / mỗi bộ neo: **1**
- Giới hạn tối đa companion KM: **để trống** (không trần)
- Kích hoạt ngay: **có**

Giả sử trong DB: SPU neo `100` + phân loại `2` (vd. IP16PM-256-Black); SPU ốp `500` + phân loại `538`:

```json
{
  "anchorProductId": 100,
  "anchorVariantId": 2,
  "companionProductId": 500,
  "companionVariantId": 538,
  "promoUnitPrice": 0,
  "minAnchorQuantity": 1,
  "companionPromoUnitsPerAnchor": 1,
  "enabled": true
}
```

Tối giản (mặc định min neo / tỉ lệ / enabled):

```json
{
  "anchorProductId": 100,
  "anchorVariantId": 2,
  "companionProductId": 500,
  "companionVariantId": 538,
  "promoUnitPrice": 0
}
```

`maxCompanionPromoUnits` không gửi → **không giới hạn** theo entity.

**`POST`** `{api.prefix}/admin/promotions/purchase-with-purchase`  
`Content-Type: application/json`

---

## Ví dụ 2 — Mỗi lần đủ neo, tối đa **2** đơn vị đi kèm được giá KM

Cùng cặp sản phẩm, đổi tỉ lệ `companionPromoUnitsPerAnchor` thành **2**; vẫn không trần tổng:

```json
{
  "anchorProductId": 100,
  "anchorVariantId": 2,
  "companionProductId": 500,
  "companionVariantId": 538,
  "promoUnitPrice": 49000,
  "minAnchorQuantity": 1,
  "companionPromoUnitsPerAnchor": 2,
  "enabled": true
}
```

---

## Ví dụ 3 — Có trần: tối đa **5** đơn vị companion được giá KM trên một đơn

```json
{
  "anchorProductId": 100,
  "anchorVariantId": 2,
  "companionProductId": 500,
  "companionVariantId": 538,
  "promoUnitPrice": 29000,
  "minAnchorQuantity": 2,
  "companionPromoUnitsPerAnchor": 1,
  "maxCompanionPromoUnits": 5,
  "enabled": true
}
```

---

## Response tạo thành công (`PurchaseWithPurchaseOfferResponse`)

`201 Created`, `data` gồm các field phản chiếu đã lưu, ví dụ:

```json
{
  "success": true,
  "message": "Created",
  "data": {
    "id": 15,
    "anchorProductId": 100,
    "anchorVariantId": 2,
    "companionProductId": 500,
    "companionVariantId": 538,
    "promoUnitPrice": 0.0,
    "minAnchorQuantity": 1,
    "companionPromoUnitsPerAnchor": 1,
    "maxCompanionPromoUnits": null,
    "enabled": true
  }
}
```

---

## Lỗi thường gặp

| Tình huống | HTTP / ý nghĩa |
|------------|----------------|
| Companion đã có chương trình PwP khác | **409 Conflict** |
| Neo và đi kèm trùng id | **400** |
| `anchorProductId` / `companionProductId` không tồn tại | **404** |
| Xóa offer đang `enabled: true` | **409** (theo `MessageConstant`) |

---

*Tài liệu căn cứ: `AdminPurchaseWithPurchaseController`, `UpsertPurchaseWithPurchaseRequest`, `PurchaseWithPurchaseOfferEntity`, `PurchaseWithPurchaseOfferServiceImpl`.*
