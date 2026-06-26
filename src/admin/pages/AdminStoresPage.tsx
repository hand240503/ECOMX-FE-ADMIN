import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { clsx } from 'clsx';
import { Loader2, MapPin, Plus, Pencil, Trash2, Search, Star } from 'lucide-react';
import { adminStoreService } from '../../api/services/adminStoreService';
import type { StoreResponse, StoreCreateRequest } from '../../api/types/store.types';
import { notify } from '../../utils/notify';
import { getApiErrorMessage } from '../../utils/apiError';
import { adminAccessControlUi } from '../../lib/adminAccessControlUi';
import { PricingPageHeader } from '../components/pricing/PricingPageHeader';

// Trung tâm Việt Nam (Đà Nẵng) làm mặc định khi chưa có toạ độ.
const VN_CENTER: [number, number] = [16.0471, 108.2068];

const storeMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const inputCls =
  'rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';
const primaryBtn =
  'inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50';
const ghostBtn =
  'inline-flex items-center gap-2 rounded-lg border border-[var(--bg-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50';

const emptyForm: StoreCreateRequest = {
  code: '', name: '', phone: '', addressLine: '', city: '', note: '', active: true, isDefault: false,
};

/** Bắt sự kiện click trên bản đồ để đặt toạ độ kho. */
function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

/** Di chuyển bản đồ tới toạ độ hiện tại của form. */
function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    }
  }, [lat, lng, map]);
  return null;
}

async function geocodeNominatim(query: string): Promise<{ lat: number; lon: number; display: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=vi&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Geocoding lỗi');
  const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (Array.isArray(arr) && arr.length > 0) {
    return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon), display: arr[0].display_name };
  }
  return null;
}

export default function AdminStoresPage() {
  const queryClient = useQueryClient();
  const canCreate = adminAccessControlUi.canCreateStores();
  const canUpdate = adminAccessControlUi.canUpdateStores();
  const canDelete = adminAccessControlUi.canDeleteStores();

  const [editing, setEditing] = useState<StoreResponse | null>(null);
  const [form, setForm] = useState<StoreCreateRequest>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);

  const storesQuery = useQuery({ queryKey: ['admin-stores'], queryFn: ({ signal }) => adminStoreService.list(undefined, signal) });
  const stores = useMemo(() => storesQuery.data ?? [], [storesQuery.data]);

  const lat = form.latitude ?? null;
  const lng = form.longitude ?? null;

  const startCreate = () => { setEditing(null); setForm(emptyForm); setSearchText(''); };
  const startEdit = (s: StoreResponse) => {
    setEditing(s);
    setForm({
      code: s.code, name: s.name, phone: s.phone ?? '', addressLine: s.addressLine ?? '', city: s.city ?? '',
      latitude: s.latitude ?? undefined, longitude: s.longitude ?? undefined, active: s.active, isDefault: s.isDefault, note: s.note ?? '',
    });
    setSearchText('');
  };

  const setCoords = (la: number, lo: number) =>
    setForm((f) => ({ ...f, latitude: Math.round(la * 1e6) / 1e6, longitude: Math.round(lo * 1e6) / 1e6 }));

  const onSearch = async () => {
    const q = searchText.trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await geocodeNominatim(q);
      if (!r) { notify.error('Không tìm thấy địa điểm'); return; }
      setCoords(r.lat, r.lon);
      setForm((f) => ({ ...f, addressLine: f.addressLine?.trim() ? f.addressLine : r.display }));
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Tìm địa điểm thất bại'));
    } finally {
      setSearching(false);
    }
  };

  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['admin-stores'] }); };

  const onSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) { notify.error('Mã kho và tên kho là bắt buộc'); return; }
    setSaving(true);
    try {
      const body: StoreCreateRequest = {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        latitude: form.latitude != null && Number.isFinite(Number(form.latitude)) ? Number(form.latitude) : undefined,
        longitude: form.longitude != null && Number.isFinite(Number(form.longitude)) ? Number(form.longitude) : undefined,
      };
      if (editing) { await adminStoreService.update(editing.id, body); notify.success('Đã cập nhật kho'); }
      else { await adminStoreService.create(body); notify.success('Đã tạo kho'); }
      await refresh();
      startCreate();
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Lưu kho thất bại'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (s: StoreResponse) => {
    if (!window.confirm(`Xoá kho "${s.name}"? Chỉ xoá được khi kho không còn tồn và chưa gắn đơn.`)) return;
    try {
      await adminStoreService.remove(s.id);
      notify.success('Đã xoá kho');
      if (editing?.id === s.id) startCreate();
      await refresh();
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Xoá kho thất bại'));
    }
  };

  return (
    <div className="space-y-6">
      <PricingPageHeader
        title="Quản lý kho / cửa hàng"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Danh sách kho */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Danh sách kho ({stores.length})</p>
            {canCreate && <button type="button" onClick={startCreate} className={ghostBtn}><Plus className="size-3.5" /> Thêm kho</button>}
          </div>
          {storesQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">Đang tải…</p>
          ) : stores.length === 0 ? (
            <p className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-6 text-center text-sm text-[var(--text-muted)]">Chưa có kho nào.</p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-[var(--bg-border)]/70 overflow-auto rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)]">
              {stores.map((s) => (
                <li key={s.id} className={clsx('flex items-center justify-between gap-2 px-3 py-2.5', editing?.id === s.id && 'bg-[var(--accent-soft)]')}>
                  <button type="button" onClick={() => startEdit(s)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--text-primary)]">
                      {s.isDefault && <Star className="size-3.5 shrink-0 fill-[var(--accent)] text-[var(--accent)]" />}
                      {s.name}
                      {!s.active && <span className="rounded bg-[var(--danger)]/10 px-1.5 py-0.5 text-[10px] text-[var(--danger)]">Ngừng</span>}
                    </p>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {s.code} · {s.city || s.addressLine || '—'}
                      {s.latitude != null && s.longitude != null ? ' · 📍' : ' · chưa có toạ độ'}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {canUpdate && <button type="button" onClick={() => startEdit(s)} className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"><Pencil className="size-3.5" /></button>}
                    {canDelete && <button type="button" onClick={() => void onDelete(s)} className="rounded p-1.5 text-[var(--danger)] hover:bg-[var(--danger)]/10"><Trash2 className="size-3.5" /></button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Form + bản đồ */}
        <div className="space-y-4 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-surface)] p-4 shadow-[var(--card-shadow)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{editing ? `Sửa kho: ${editing.name}` : 'Thêm kho mới'}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">Mã kho *
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={inputCls} placeholder="HN01" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">Tên kho *
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Kho Hà Nội" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">SĐT
              <input value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">Thành phố
              <input value={form.city ?? ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] sm:col-span-2">Địa chỉ
              <input value={form.addressLine ?? ''} onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))} className={inputCls} />
            </label>
          </div>

          {/* Tìm địa điểm + toạ độ */}
          <div className="space-y-2 rounded-lg border border-[var(--bg-border)] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]"><MapPin className="size-3.5" /> Vị trí kho (click trên bản đồ hoặc tìm địa chỉ)</p>
            <div className="flex gap-2">
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onSearch(); } }}
                placeholder="Tìm địa chỉ trên bản đồ… (VD: 1 Đại Cồ Việt, Hà Nội)"
                className={clsx(inputCls, 'flex-1')}
              />
              <button type="button" onClick={() => void onSearch()} disabled={searching} className={ghostBtn}>
                {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />} Tìm
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">Vĩ độ (lat)
                <input type="number" step="any" value={form.latitude ?? ''} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value === '' ? undefined : Number(e.target.value) }))} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">Kinh độ (lng)
                <input type="number" step="any" value={form.longitude ?? ''} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value === '' ? undefined : Number(e.target.value) }))} className={inputCls} />
              </label>
            </div>

            <div className="h-[360px] overflow-hidden rounded-lg border border-[var(--bg-border)]">
              <MapContainer center={lat != null && lng != null ? [lat, lng] : VN_CENTER} zoom={lat != null && lng != null ? 14 : 5} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickCapture onPick={setCoords} />
                <Recenter lat={lat} lng={lng} />
                {lat != null && lng != null && <Marker position={[lat, lng]} icon={storeMarkerIcon} />}
              </MapContainer>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">Toạ độ dùng để tính phí ship từ kho tới khách. Click vào bản đồ để chọn điểm.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.active ?? true} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Đang hoạt động</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.isDefault ?? false} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} /> Đặt làm kho mặc định</label>
          </div>

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">Ghi chú
            <textarea value={form.note ?? ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} className={inputCls} />
          </label>

          {(canCreate || canUpdate) && (
            <div className="flex gap-2">
              <button type="button" onClick={() => void onSubmit()} disabled={saving} className={primaryBtn}>
                {saving && <Loader2 className="size-3.5 animate-spin" />} {editing ? 'Lưu thay đổi' : 'Tạo kho'}
              </button>
              {editing && <button type="button" onClick={startCreate} className={ghostBtn}>Huỷ sửa</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
