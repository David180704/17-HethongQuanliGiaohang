import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient, errorMessage } from "../lib/apiClient.js";
import { queryCache } from "../lib/queryCache.js";
import { useCachedQuery } from "../lib/useCachedQuery.js";
import { formatVnd } from "../lib/format.js";
import {
  FEE_PAYMENT_METHOD_LABELS,
  feePayerLabel,
  formatDateTime,
  packingLabel,
  zoneLabel,
} from "../lib/orderView.js";
import FeeBreakdown from "../components/FeeBreakdown.jsx";
import StatusBadge from "../components/order/StatusBadge.jsx";
import UpdatedAt from "../components/UpdatedAt.jsx";
import IncidentSection from "../components/order/IncidentSection.jsx";

// US-20: chi tiet don cua khach kem toan bo hanh trinh (statusHistory nhung trong don, moi nhat o tren).
export default function OrderDetailPage() {
  const { id } = useParams();
  const { data: order, error, updatedAt, refresh } = useCachedQuery(`/orders/${id}`);
  const [returnState, setReturnState] = useState({ busy: false, message: "", error: "" });

  // US-37: tai xe da tra hang hoan -> nguoi gui xac nhan da nhan lai (ket thuc theo doi hoan hang)
  async function confirmReturn() {
    setReturnState({ busy: true, message: "", error: "" });
    try {
      await apiClient.post(`/deliveries/${id}/confirm-return`);
      queryCache.invalidate("/orders");
      setReturnState({ busy: false, message: "Đã xác nhận nhận lại hàng", error: "" });
      refresh();
    } catch (err) {
      setReturnState({ busy: false, message: "", error: errorMessage(err) });
    }
  }

  if (error) {
    const notFound = error?.response?.status === 404;
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {notFound ? "Không tìm thấy đơn hàng (đơn không tồn tại hoặc không thuộc tài khoản này)." : errorMessage(error)}
        </div>
        <BackLink />
      </div>
    );
  }
  if (!order) return <p className="mx-auto max-w-3xl px-4 py-10 text-gray-500">Đang tải...</p>;

  const journey = [...order.statusHistory].reverse();
  const flags = [order.flags?.fragile && "Dễ vỡ", order.flags?.highValue && "Giá trị cao", order.flags?.isVehicle && "Hàng là xe"].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <BackLink />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Mã vận đơn</p>
          <h1 className="text-3xl font-extrabold tracking-wide text-brand-600">{order.trackingCode}</h1>
          <p className="mt-1 text-sm text-gray-500">Tạo lúc {formatDateTime(order.createdAt)}</p>
          <Link to={`/tra-cuu?ma=${order.trackingCode}`} className="text-sm font-medium text-brand-600 hover:underline">
            Link tra cứu công khai cho người nhận
          </Link>
        </div>
        <StatusBadge display={order.display} />
      </div>
      <div className="mt-2">
        <UpdatedAt date={updatedAt} onRefresh={refresh} />
      </div>

      {(order.deliveryAttempts > 0 || order.status === "RETURNING" || order.status === "RETURNED") && (
        <section aria-label="Giao hàng và hoàn hàng" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          {order.deliveryAttempts > 0 && <p>Đã giao không thành công {order.deliveryAttempts} lần.</p>}
          {order.returnReason && <p>Hoàn về người gửi: {order.returnReason}.</p>}
          {order.status === "RETURNING" && !order.returnHandedAt && <p>Express đang đưa hàng hoàn về địa điểm lấy hàng của bạn.</p>}
          {order.status === "RETURNING" && order.returnHandedAt && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p>Người giao hàng đã trả hàng lúc {formatDateTime(order.returnHandedAt)}.</p>
              <button
                type="button"
                onClick={confirmReturn}
                disabled={returnState.busy}
                className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Đã nhận lại hàng
              </button>
            </div>
          )}
          {returnState.message && <p role="status" className="mt-2 font-medium text-green-700">{returnState.message}</p>}
          {returnState.error && <p role="alert" className="mt-2 text-red-700">{returnState.error}</p>}
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section aria-label="Hành trình đơn hàng" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">Hành trình</h2>
          <ol className="mt-4 space-y-4">
            {journey.map((step, index) => (
              <li key={`${step.status}-${step.at}`} className="flex gap-3">
                <span
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full ${index === 0 ? "bg-brand-600 ring-4 ring-brand-100" : "bg-gray-300"}`}
                  aria-hidden="true"
                />
                <div>
                  <p className={`text-sm ${index === 0 ? "font-semibold" : "font-medium text-gray-700"}`}>{step.label}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(step.at)}</p>
                  {step.note && <p className="mt-0.5 text-xs text-gray-500">{step.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-6">
          <section aria-label="Người nhận" className="rounded-xl border border-gray-200 bg-white p-5 text-sm">
            <h2 className="font-semibold">Người nhận</h2>
            <p className="mt-2 font-medium">
              {order.receiver.name} · {order.receiver.phone}
            </p>
            <p className="text-gray-600">
              {order.receiver.address}, {order.receiver.ward}, {order.receiver.province}
            </p>
            <p className="mt-2 text-gray-500">
              Người gửi: {order.customerName} · lấy hàng tại {order.pickupWard}
            </p>
          </section>

          <section aria-label="Hàng hóa và dịch vụ" className="rounded-xl border border-gray-200 bg-white p-5 text-sm">
            <h2 className="font-semibold">Hàng hóa và dịch vụ</h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className="text-gray-500">Hàng</dt>
              <dd>
                {order.item.name} ({packingLabel(order.item.packingType)})
              </dd>
              <dt className="text-gray-500">Khối lượng, kích thước</dt>
              <dd>
                {order.item.weightGram} g · {order.item.length}×{order.item.width}×{order.item.height} cm
              </dd>
              <dt className="text-gray-500">Khối lượng tính phí</dt>
              <dd>{order.chargeableWeight} g</dd>
              <dt className="text-gray-500">Dịch vụ, vùng</dt>
              <dd>
                {order.serviceName} · {zoneLabel(order.zone)}
              </dd>
              {order.item.declaredValue > 0 && (
                <>
                  <dt className="text-gray-500">Giá trị khai báo</dt>
                  <dd>{formatVnd(order.item.declaredValue)}</dd>
                </>
              )}
              {flags.length > 0 && (
                <>
                  <dt className="text-gray-500">Đặc tính</dt>
                  <dd>{flags.join(", ")}</dd>
                </>
              )}
            </dl>
          </section>

          <section aria-label="Phí và thu hộ" className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold">Phí vận chuyển</h2>
            <div className="mt-2">
              <FeeBreakdown fee={order.fee} label="Phí của đơn" />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {order.fee.lockedAt
                ? `Phí đã khóa lúc ${formatDateTime(order.fee.lockedAt)} — bảng giá đổi sau này không ảnh hưởng.`
                : "Phí tạm tính theo bảng giá lúc tạo đơn; khóa khi bưu cục xác nhận."}
            </p>
            <p className="mt-3 text-sm">
              Người trả phí: <span className="font-medium">{feePayerLabel(order.cod?.feePayer)}</span>
              {order.cod?.feePaymentMethod && ` (${FEE_PAYMENT_METHOD_LABELS[order.cod.feePaymentMethod]})`}
            </p>
            <p className="text-sm">
              Thu hộ:{" "}
              <span className="font-medium">{order.cod?.enabled ? formatVnd(order.cod.amount) : "Không thu hộ"}</span>
            </p>
          </section>
        </div>
      </div>
      <IncidentSection orderId={id} onChanged={refresh} />
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/don-hang" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
      ← Đơn hàng của tôi
    </Link>
  );
}
