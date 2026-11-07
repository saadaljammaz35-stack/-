import Link from "next/link";
import { getLocale } from "@/lib/locale";

export default async function NotFound() {
  const ar = (await getLocale()) === "ar";
  return (
    <div className="wrap page" style={{ textAlign: "center" }}>
      <p className="mono muted">404</p>
      <h1 style={{ fontSize: "2rem" }}>{ar ? "الصفحة مهيب موجودة" : "Page not found"}</h1>
      <Link className="btn" href="/">{ar ? "رجّعني للرئيسية" : "Home"}</Link>
    </div>
  );
}
