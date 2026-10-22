import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient.js";
import ResourceForm from "./ResourceForm.jsx";
import Modal from "./Modal.jsx";

// config: { title, endpoint, columns: [{key,label,render?}],
//   createFields, updateFields, searchPlaceholder, allowDelete }
export default function ResourcePage({ config }) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [editingItem, setEditingItem] = useState(null); // null=khong mo, {}=tao moi, {...}=sua
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await apiClient.get(config.endpoint, {
          params: { page, limit: meta.limit, search: search || undefined },
        });
        setItems(res.data.data);
        setMeta(res.data.meta);
      } catch (err) {
        setErrorMsg(err?.response?.data?.error?.message || "Không tải được dữ liệu");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.endpoint, search, refreshKey],
  );

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function handleCreate(values) {
    await apiClient.post(config.endpoint, values);
    setEditingItem(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleUpdate(id, values) {
    await apiClient.put(`${config.endpoint}/${id}`, values);
    setEditingItem(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(item) {
    if (!window.confirm(`Xóa "${item[config.columns[0].key]}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await apiClient.delete(`${config.endpoint}/${item._id}`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err?.response?.data?.error?.message || "Không xóa được");
    }
  }

  const isEditing = editingItem && editingItem._id;
  const isCreating = editingItem && !editingItem._id;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{config.title}</h1>
        <button
          onClick={() => setEditingItem({})}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Thêm mới
        </button>
      </div>

      <input
        type="text"
        placeholder={config.searchPlaceholder || "Tìm kiếm..."}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />

      {errorMsg && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</div>}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {config.columns.map((col) => (
                <th key={col.key} className="px-4 py-2 text-left font-medium text-gray-600">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-medium text-gray-600">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={config.columns.length + 1} className="px-4 py-6 text-center text-gray-400">
                  Đang tải...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={config.columns.length + 1} className="px-4 py-6 text-center text-gray-400">
                  Không có dữ liệu
                </td>
              </tr>
            )}
            {!loading &&
              items.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  {config.columns.map((col) => (
                    <td key={col.key} className="px-4 py-2 text-gray-800">
                      {col.render ? col.render(item) : String(item[col.key] ?? "")}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="mr-3 text-blue-600 hover:underline"
                    >
                      Sửa
                    </button>
                    {config.allowDelete !== false && (
                      <button onClick={() => handleDelete(item)} className="text-red-600 hover:underline">
                        Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          Tổng {meta.total} bản ghi — trang {meta.page}
        </span>
        <div className="flex gap-2">
          <button
            disabled={meta.page <= 1}
            onClick={() => load(meta.page - 1)}
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
          >
            Trước
          </button>
          <button
            disabled={meta.page * meta.limit >= meta.total}
            onClick={() => load(meta.page + 1)}
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </div>

      {(isCreating || isEditing) && (
        <Modal title={isCreating ? `Thêm ${config.title}` : `Sửa ${config.title}`} onClose={() => setEditingItem(null)}>
          <ResourceForm
            fields={isCreating ? config.createFields : config.updateFields}
            initialValues={isEditing ? editingItem : {}}
            onCancel={() => setEditingItem(null)}
            onSubmit={(values) => (isCreating ? handleCreate(values) : handleUpdate(editingItem._id, values))}
          />
        </Modal>
      )}
    </div>
  );
}
