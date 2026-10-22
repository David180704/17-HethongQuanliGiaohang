import { Link } from "react-router-dom";

// Khung chung cho trang dang nhap / dang ky: thanh thuong hieu + the form o giua.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-extrabold text-brand-600">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">E</span>
            EDMS Express
          </Link>
          <span className="text-lg text-gray-300">|</span>
          <span className="text-lg font-medium text-gray-700">{title}</span>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center bg-linear-to-b from-brand-600 to-brand-500 px-4 py-10 sm:items-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-gray-100 pt-4 text-center text-sm text-gray-600">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

// Gan nhan bang htmlFor/id thay vi boc <label> quanh o nhap: neu label boc ca
// nut "Hiện" ben canh, ten truy cap cua o nhap thanh "Mật khẩu Hiện".
export function Field({ id, label, children, hint }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
