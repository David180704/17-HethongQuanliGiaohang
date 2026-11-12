import { useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, errorMessage } from "../lib/apiClient.js";
import { queryCache } from "../lib/queryCache.js";
import { useCachedQuery } from "../lib/useCachedQuery.js";
import PickupLocationForm from "../components/PickupLocationForm.jsx";

// Dia diem lay hang cua khach (US-15): toi da 10, dung mot dia diem mac dinh,
// shipper den dia diem nay lay hang. Chan xoa / doi dia chi khi con don dang xu ly (server).
export default function PickupLocationsPage() {
  const { data, meta, loading, error: loadError, refresh } = useCachedQuery("/pickupLocations");
  const locations = data || [];
  const max = meta?.max ?? 10;
  const full = locations.length >= max;
  const [editing, setEditing] = useState(null); // null = dong form, {} = them moi, location = sua
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function done(message) {
    setEditing(null);
    setError("");
    setNotice(message);
    refresh();
  }

  async function act(request, message) {
    setNotice("");
    setError("");
    try {
      await request();
      queryCache.invalidate("/pickupLocations");
      done(message);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const remove = (location) => {
    if (!window.confirm(`Xóa địa điểm "${location.label}"?`)) return;
    act(() => apiClient.delete(`/pickupLocations/${location._id}`), `Đã xóa "${location.label}"`);
  };
  const makeDefault = (location) =>
    act(() => apiClient.put(`/pickupLocations/${location._id}`, { isDefault: true }), `"${location.label}" là địa điểm mặc định`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">
            <Link to="/tai-khoan" className="hover:underline">
              Tài khoản
            </Link>{" "}
            / Địa điểm lấy hàng
          </p>
          <h1 className="text-2xl font-bold">Địa điểm lấy hàng</h1>
          <p className="mt-1 text-sm text-gray-600" role="status">
            {loading ? "Đang tải..." : `${locations.length}/${max} địa điểm · shipper đến đây lấy hàng`}
          </p>
        </div>
        <button
          type="button"
          disabled={full || Boolean(editing)}
          onClick={() => setEditing({})}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          + Thêm địa điểm
        </button>
      </div>
      {full && <p className="mt-2 text-sm text-amber-700">Đã đủ {max} địa điểm — xóa bớt địa điểm cũ để thêm mới.</p>}

      {notice && (
        <div role="status" className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}
      {(error || loadError) && (
        <div role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || errorMessage(loadError, "Không tải được địa điểm lấy hàng")}
        </div>
      )}

      {editing && (
        <section className="mt-6 rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">{editing._id ? `Sửa "${editing.label}"` : "Thêm địa điểm lấy hàng"}</h2>
          <PickupLocationForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={(saved) => done(editing._id ? `Đã lưu "${saved.label}"` : `Đã thêm "${saved.label}"`)}
          />
        </section>
      )}

      {!loading && locations.length === 0 && !editing && (
        <p className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-500">
          Chưa có địa điểm lấy hàng. Thêm địa điểm đầu tiên — địa điểm này sẽ là mặc định khi tạo đơn.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {locations.map((location) => (
          <li key={location._id} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{location.label}</h2>
              {location.isDefault && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Mặc định</span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-700">
              {location.contactName} · {location.contactPhone}
            </p>
            <p className="text-sm text-gray-600">
              {location.address}, {location.ward}, {location.province}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                aria-label={`Sửa ${location.label}`}
                onClick={() => setEditing(location)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
              >
                Sửa
              </button>
              {!location.isDefault && (
                <button
                  type="button"
                  aria-label={`Đặt ${location.label} làm mặc định`}
                  onClick={() => makeDefault(location)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
                >
                  Đặt làm mặc định
                </button>
              )}
              <button
                type="button"
                aria-label={`Xóa ${location.label}`}
                onClick={() => remove(location)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Xóa
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
