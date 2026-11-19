import type { ReceiptData } from '@/lib/printing/receipt-data';

const money = (h: number) => (h / 100).toFixed(2);
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Receipt / invoice / kitchen ticket markup. Formal Arabic for the financial document. */
export function Receipt({ d, format }: { d: ReceiptData; format: '80mm' | '58mm' | 'a4' }) {
  const width = format === '58mm' ? '48mm' : format === '80mm' ? '72mm' : '180mm';
  const small = format === '58mm';
  const kitchen = d.kind === 'kitchen_ticket';
  return (
    <article dir="rtl" className="receipt mx-auto bg-white text-black" style={{ width, fontSize: small ? 11 : format === 'a4' ? 13 : 12, lineHeight: 1.45, fontFamily: 'var(--font-readex), Tahoma, sans-serif' }} data-testid="receipt">
      <style>{`@page { size: ${format === 'a4' ? 'A4' : `${format} auto`}; margin: ${format === 'a4' ? '14mm' : '3mm'}; } @media print { body { margin: 0 } .receipt { width: auto !important } }`}</style>
      <header style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: 6, marginBottom: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/samat-logo-ink.png" alt="SAMAT سماط" style={{ width: small ? 70 : 90, margin: '0 auto 4px' }} />
        {kitchen ? (
          <p style={{ fontSize: small ? 16 : 20, fontWeight: 700 }}>ورقة المطبخ · KITCHEN</p>
        ) : (
          <>
            <p style={{ fontWeight: 700 }}>{d.seller.name}</p>
            {d.seller.address && <p>{d.seller.address}</p>}
            {d.seller.vat && <p>الرقم الضريبي: <span dir="ltr">{d.seller.vat}</span></p>}
            {d.seller.cr && <p>السجل التجاري: <span dir="ltr">{d.seller.cr}</span></p>}
            <p style={{ fontWeight: 700, marginTop: 4 }}>{d.invoice ? 'فاتورة ضريبية مبسطة' : 'ملخص طلب (ليست فاتورة ضريبية)'}</p>
            {d.invoice?.status === 'credited' && <p style={{ fontWeight: 700 }}>— ملغاة / CREDITED —</p>}
          </>
        )}
      </header>
      <section style={{ borderBottom: '1px dashed #000', paddingBottom: 6, marginBottom: 6 }}>
        <p style={{ fontSize: kitchen ? 26 : 18, fontWeight: 700, textAlign: 'center' }}>طلب رقم #{d.order.number}</p>
        <p style={{ textAlign: 'center' }}>رمز الاستلام: <strong dir="ltr" style={{ letterSpacing: 2 }}>{d.order.pickupCode}</strong></p>
        {d.invoice && <p>رقم الفاتورة: <span dir="ltr">{d.invoice.number}</span></p>}
        <p>التاريخ: <span dir="ltr">{fmt(d.invoice?.issuedAt ?? d.order.createdAt)}</span></p>
        <p>العميل: {d.order.customerName}</p>
      </section>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {d.items.map((i, k) => (
            <tr key={k} style={{ verticalAlign: 'top', borderBottom: '1px dotted #999' }}>
              <td style={{ padding: '3px 0', fontWeight: 700, fontSize: kitchen ? '1.3em' : undefined, width: 28 }}>{i.qty}×</td>
              <td style={{ padding: '3px 0' }}>
                <div style={{ fontWeight: 700, fontSize: kitchen ? '1.2em' : undefined }}>{i.nameAr}</div>
                {i.bread && <div>الخبز: <strong>{i.bread}</strong></div>}
                {i.mods.map((m, j) => (
                  <div key={j} style={{ fontWeight: kitchen && m.action === 'removed' ? 800 : undefined }}>
                    {m.action === 'removed' ? '✕ بدون ' : m.action === 'selected' ? '• ' : '+ '}{m.nameAr}{m.qty > 1 && m.action !== 'removed' ? ` ×${m.qty}` : ''}
                    {!kitchen && m.price > 0 && <span> ({money(m.price)})</span>}
                  </div>
                ))}
                {i.notes && <div>ملاحظة: {i.notes}</div>}
              </td>
              {!kitchen && <td style={{ padding: '3px 0', textAlign: 'left', whiteSpace: 'nowrap' }} dir="ltr">{money(i.lineTotal)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {d.order.notes && <p style={{ marginTop: 6, fontWeight: 700 }}>ملاحظات الطلب: {d.order.notes}</p>}
      {!kitchen && (
        <section style={{ borderTop: '1px dashed #000', marginTop: 6, paddingTop: 6 }}>
          <Row k="المجموع" v={money(d.totals.subtotal)} />
          {d.totals.discount > 0 && <Row k="الخصم" v={`- ${money(d.totals.discount)}`} />}
          <Row k={d.totals.inclusive ? 'الإجمالي غير شامل الضريبة' : 'الإجمالي قبل الضريبة'} v={money(d.totals.total - d.totals.vat)} />
          <Row k={`ضريبة القيمة المضافة ${d.totals.vatRate / 100}%`} v={money(d.totals.vat)} />
          <Row k="الإجمالي شامل الضريبة (ر.س)" v={money(d.totals.total)} bold />
          <p style={{ marginTop: 4 }}>حالة الدفع: {({ paid: 'مدفوع', authorized: 'مفوّض', not_required: 'لا يتطلب', pending_verification: 'تحويل قيد التحقق', refunded: 'مسترجع', refund_pending: 'استرجاع قيد المعالجة' } as Record<string, string>)[d.order.paymentStatus] ?? d.order.paymentStatus}</p>
        </section>
      )}
      {d.zatcaQrSvg && <div style={{ width: small ? 110 : 130, margin: '8px auto 0' }} dangerouslySetInnerHTML={{ __html: d.zatcaQrSvg }} />}
      {!kitchen && (d.seller.footerAr || d.seller.footerEn) && <p style={{ textAlign: 'center', marginTop: 6 }}>{d.seller.footerAr}<br />{d.seller.footerEn}</p>}
      <p style={{ textAlign: 'center', marginTop: 6, fontSize: '0.85em' }}>شكراً لكم — SAMAT</p>
    </article>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 700 : undefined }}><span>{k}</span><span dir="ltr">{v}</span></div>;
}
