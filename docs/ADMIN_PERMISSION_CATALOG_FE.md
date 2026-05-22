# FE Admin — Bảng quyền hệ thống (sau khi gộp module)

Tài liệu này mô tả **cách hiển thị và gửi payload** khi xây dựng màn phân quyền (role / cấp thêm cho user) sau khi backend **gộp**:

- **Sản phẩm (catalogue)**: product + giá + đơn vị tính + thương hiệu + danh mục (+ media đính catalogue sản phẩm theo luồng document) → **một nhóm quyền duy nhất** **`100xxx`** (`MODULE_PRODUCT = 100`). **Không** còn các quyền catalogue tách riêng theo “quản lý danh mục”, “quản lý giá”, … trong bảng phân quyền — mọi thứ thuộc nhóm catalogue sản phẩm đều đi qua cùng khối CRUD `100001–100004`.
- **Quản lý user**: toàn bộ tài khoản trong hệ thống (khách + nội bộ; legacy `400xxx` gộp vào đây) → **một nhóm quyền duy nhất** **`700xxx`** (`MODULE_USER = 700`). **Không** chia nhỏ catalogue thành “chỉ nhân viên”, “chỉ khách”, … — chỉ có CRUD “user trong hệ thống” (`700001–700004`). Các route `/admin/customers`, `/admin/staff` chỉ là **lọc UI** tương thích FE cũ, không phải tập permission riêng trong catalogue.

## Quyền “đang lưu” vs quyền “được gọi API”

Khi đọc `GET …/admin/users/{userId}/permissions` (`UserPermissionsResponse`):

- **`rolePermissions` / `userPermissions` / `effectivePermissions`** là hợp **role ∪ grant** (grant chưa hết hạn). Danh sách này **không** tự bung wildcard hệ thống `101–104` thành từng mã `100002`, `300002`, …
- **Kiểm tra thực tế trên endpoint** (Spring `PermissionService#hasPermission` / `requireAnyPermission`) dùng **`PermissionEvaluator`**: có đúng mã 6 chữ số **hoặc** wildcard tương ứng (`101`→CREATE_ALL, `102`→READ_ALL, …); hai mã 6 chữ số **tương đương** nếu cùng kết quả sau `normalizeGrantPermissionCode` (vd legacy `150002` vs `100002`).

**Gợi ý FE:** ma trận checkbox và nhãn hiển thị bám `effectivePermissions` + chuẩn hoá legacy → ô đã tick; còn **ẩn menu / disable nút theo route** nên bám cùng logic evaluator (hoặc probe backend), không chỉ nhìn raw list nếu user có `102`/`103`/… mà list không liệt kê đủ mã module.

Tham chiếu code backend: `PermissionCode`, `PermissionDescriptions`, `RolePermissionDefaults`, `PermissionEvaluator`, `UserEntity#getAllPermissions`, `UserPermissionsResponse`, `RolePermissionController`.

## Chú giải cột (đề xuất UI)

| Ký hiệu / cột | Ý nghĩa |
|----------------|---------|
| **Cấp trực tiếp** | Quyền cấp thêm cho user (bảng grants), không phải mặc định role |
| **Từ chức vụ** | Quyền mặc định theo role (JSON trên entity role) |
| **Hệ thống** | Mã 3 chữ số: `101–104` và `110–112` (toàn hệ thống / lock / role / grant) |
| **Chưa có** | Không có quyền tương ứng trong tập hiệu lực |
| **Phân hệ** | Một hàng trên bảng — tương ứng một **prefix 3 chữ số** của mã 6 chữ số |
| **Tạo / Xem / Cập nhật / Xóa** | Theo `ACTION`: `001 → CREATE`, `002 → READ`, `003 → UPDATE`, `004 → DELETE` |

## Ma trận phân hệ (hàng) sau khi gộp

Hiển thị **5 nhóm module** cho mã 6 chữ số (mỗi nhóm 4 cột CRUD):

| Phân hệ (UI) | Prefix chuẩn | Ghi chú |
|--------------|---------------|---------|
| **Sản phẩm** (catalogue) | `100` | Bao gồm: SKU, giá catalog / price change / volume tier / PwP, đơn vị, hãng, danh mục |
| **Tài liệu** | `300` | Upload / xem / sửa / xóa **document độc lập** (vd file chưa gắn entity). Media đính **SKU / variant / danh mục / hãng** đi qua luồng document nhưng kiểm tra quyền theo **`100xxx`** (+ wildcard `101–104`), không bắt buộc `300xxx` cho các thao tác đó |
| **Đơn hàng** | `500` | Không đổi |
| **Báo cáo** | `600` | Không đổi |
| **Quản lý user** | `700` | Bao gồm Staff / Employee / thao tác user nội bộ từng được tách `400xxx`; mã chuẩn khi **lưu** là `700xxx` |

### Mã gợi ý khi render ô checkbox (module CRUD)

Trong `response.data.moduleSpecific` của `GET /api/v1/admin/permissions/catalog` (hoặc tương đương tiền tố `api.prefix`), mỗi phần tử có:

- `code` — số nguyên (vd `100002`)
- `label` — vd `READ PRODUCT` / `READ USER_MANAGEMENT`
- `description` — tiếng Việt, tooltip

Mapping cột:

| Cột UI | `code` = `prefix * 1000 + action` |
|--------|-----------------------------------|
| Tạo | `…001` |
| Xem | `…002` |
| Cập nhật | `…003` |
| Xóa | `…004` |

Prefix lấy từ `response.data.modules`:

- `PRODUCT_FAMILY` → `100`
- `DOCUMENT` → `300`
- `ORDER` → `500`
- `REPORT` → `600`
- `USER_MANAGEMENT` → `700`

`response.data.actions` đưa tên `CREATE` / `READ` / `UPDATE` / `DELETE` tương ứng giá trị `1..4`.

### Quyền hệ thống (không dùng prefix 3 chữ số)

Dùng danh sách `response.data.systemWide` (mã `101`, `102`, …): render **hàng riêng** hoặc nhóm “Toàn hệ thống”, không gán vào CRUD của 5 phân hệ module.

## Payload khi **grant / revoke / lưu role**

- **Luôn gửi mã chuẩn** từ catalogue: `100xxx` cho nhóm sản phẩm, `700xxx` cho quản lý user.
- Backend sẽ **`normalize`**: nếu client gửi nhầm mã legacy (`150xxx` … `200xxx`, `400xxx`) thì vẫn chấp nhận (nằm trong `allKnownCodes`) nhưng khi lưu vào role hoặc grant sẽ được chuẩn về **`100xxx` / `700xxx`**.
- **Hiển thị hiệu lực** (`effectivePermissions` trong `GET …/users/{id}/permissions`): có thể vẫn thấy **mã legacy** cho tới khi grant/role được lưu lại — có thể normalize phía FE bằng cùng quy tắc:  

  - Mọi `{100,150,160,170,200} * 1000 + action` → hiển thị tại hàng **Sản phẩm**.  
  - Mọi `{400,700} * 1000 + action` → hiển thị tại hàng **Quản lý user**.

## Gợi ý gắn route màn hình

- Màn **catalogue sản phẩm** (giá, tier, PwP, brand, unit, category, product): cần các quyền `100xxx` tương ứng thao tác.
- Luồng **upload / replace / metadata / main / xóa file** qua `/admin/document/...` (và `/document/upload`): nếu document gắn `entity_type` thuộc catalogue sản phẩm (sản phẩm, variant, danh mục, hãng) thì đủ **`100xxx`** (và evaluator wildcard); upload **chưa** gắn entity vẫn cần **`300001`** (CREATE_DOCUMENT).
- **Danh sách user đầy đủ** (mọi role): các API dưới prefix **`/admin/users`** (chi tiết / sửa / xóa / reset mật khẩu cùng họ); `/admin/customers`, `/admin/staff` chỉ là **lọc phân khúc** — quyền catalogue vẫn là khối **`700xxx`**, không có permission riêng “chỉ khách” hay “chỉ nhân viên”.

## Trường tham chiếu trong response `permissions/catalog`

`data.catalogNote.mergedModules` mô tả chính thức gộp (`canonicalPrefix` và `includesLegacyPrefixes`) để FE tự sinh bảng hoặc tooltip “mã cũ vẫn tương đương”.

`data.allKnownCodes`: tập **đầy đủ** kể cả mã legacy — chỉ dùng khi validate nâng cao; **UI bảng phân quyền** nên bám `moduleSpecific` + `systemWide`.

## Tóm tắt nhanh (khi đọc API)

| Câu hỏi | Trả lời ngắn |
|--------|----------------|
| User có những mã permission nào **đang lưu** trong DB/API? | `rolePermissions ∪ userPermissions` ⇒ **`effectivePermissions`** (không bung `101–104`). |
| User có được gọi endpoint cần `100003` không? | Phải áp dụng logic **evaluator**: có `100003`, hoặc `103` (UPDATE_ALL), hoặc mã legacy / đã chuẩn hoá **tương đương** `100003`. |
| Role **CUSTOMER** mặc định có gì trong permission? | Seed thường có **`100002`** (READ_PRODUCT); quyền **thực tế** trên từng URL vẫn phụ thuộc security config và controller — đừng coi `100002` là “được mọi API public/admin”. |

### Permission mặc định theo role (seed — tham khảo UI “mặc định chức vụ”)

| Role | Permissions mặc định (tóm tắt) |
|------|--------------------------------|
| SUPER_ADMIN | `101`, `102`, `103`, `104`, `110`, `111`, `112` |
| ADMIN | `101`, `102`, `103`, `104`, `112` |
| MANAGER | `101`, `102`, `103`, `112` (không có `104`) |
| EMPLOYEE | `100002` |
| CUSTOMER | `100002` |

`112` (GRANT_PERMISSION): cấp/thu hồi grant cho user khác trong giới hạn quyền của actor (chi tiết `RolePermissionServiceImpl`).
