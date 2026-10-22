import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-5xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-2 text-xl font-bold">Không tìm thấy trang</h1>
      <Link to="/" className="mt-6 inline-block font-semibold text-brand-600 hover:underline">
        Về trang chủ
      </Link>
    </div>
  );
}
