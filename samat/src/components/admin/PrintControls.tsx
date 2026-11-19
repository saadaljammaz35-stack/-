'use client';
import { useEffect, useState } from 'react';
import { Bluetooth, Network, Printer, Usb } from 'lucide-react';
import { EscPos, PRINTER_DOTS } from '@/lib/printing/escpos';

// Browser printing works everywhere. Direct USB / Bluetooth printing uses WebUSB / Web Bluetooth,
// which only Chromium-based browsers (Chrome / Edge on desktop and Android) support. LAN printers
// are reached through the print bridge running on a computer in the branch.

async function receiptToRaster(format: '80mm' | '58mm'): Promise<Uint8Array> {
  const el = document.querySelector('[data-testid="receipt"]') as HTMLElement;
  const dots = PRINTER_DOTS[format];
  // Render the receipt DOM into an SVG foreignObject, then onto a canvas (fonts already loaded).
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.width = `${dots}px`;
  clone.style.fontSize = format === '58mm' ? '18px' : '22px';
  const html = new XMLSerializer().serializeToString(clone);
  const height = Math.ceil(el.scrollHeight * (dots / el.clientWidth)) + 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dots}" height="${height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = dots;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, dots, height);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, dots, height).data;
  return new EscPos().init().align('center').raster(data, dots, height, 4).feed(4).cut().bytes();
}

async function logJob(orderId: string, kind: string, format: string, target: string, status: 'done' | 'failed' | 'queued', error?: string) {
  const res = await fetch('/api/admin/print-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId, kind, format, target, status, error }) });
  return res.json();
}

export function PrintControls({ orderId, kind, format, canReprint, alreadyPrinted, labels }: {
  orderId: string; kind: 'customer_receipt' | 'kitchen_ticket'; format: '80mm' | '58mm' | 'a4'; canReprint: boolean; alreadyPrinted: boolean;
  labels: { browser: string; usb: string; bt: string; lan: string; reprintDenied: string; queued: string };
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const blocked = alreadyPrinted && !canReprint;
  const thermal = format !== 'a4' ? format : null;

  useEffect(() => {
    if (blocked) return;
    const after = () => logJob(orderId, kind, format === 'a4' ? 'a4' : format, 'browser', 'done');
    window.addEventListener('afterprint', after, { once: true });
    return () => window.removeEventListener('afterprint', after);
  }, [orderId, kind, format, blocked]);

  const usb = async () => {
    try {
      const nav = navigator as unknown as { usb?: { requestDevice: (o: unknown) => Promise<{ open(): Promise<void>; selectConfiguration(n: number): Promise<void>; claimInterface(n: number): Promise<void>; configuration: { interfaces: { interfaceNumber: number; alternate: { endpoints: { direction: string; endpointNumber: number }[] } }[] }; transferOut(ep: number, d: Uint8Array): Promise<unknown>; close(): Promise<void> }> } };
      if (!nav.usb) throw new Error('WebUSB is not supported in this browser');
      const dev = await nav.usb.requestDevice({ filters: [] });
      await dev.open();
      await dev.selectConfiguration(1);
      const iface = dev.configuration.interfaces.find((i) => i.alternate.endpoints.some((e) => e.direction === 'out'))!;
      await dev.claimInterface(iface.interfaceNumber);
      const ep = iface.alternate.endpoints.find((e) => e.direction === 'out')!.endpointNumber;
      await dev.transferOut(ep, await receiptToRaster(thermal!));
      await dev.close();
      await logJob(orderId, kind, 'escpos', 'usb', 'done');
      setMsg('✓');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      await logJob(orderId, kind, 'escpos', 'usb', 'failed', String(e));
    }
  };

  const bluetooth = async () => {
    try {
      const bt = (navigator as unknown as { bluetooth?: { requestDevice: (o: unknown) => Promise<{ gatt: { connect(): Promise<{ getPrimaryService(u: string): Promise<{ getCharacteristic(u: string): Promise<{ writeValue(d: Uint8Array): Promise<void> }> }> }> } }> } }).bluetooth;
      if (!bt) throw new Error('Web Bluetooth is not supported in this browser');
      const SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';
      const dev = await bt.requestDevice({ filters: [{ services: [SERVICE] }], optionalServices: [SERVICE] });
      const server = await dev.gatt.connect();
      const ch = await (await server.getPrimaryService(SERVICE)).getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      const data = await receiptToRaster(thermal!);
      for (let i = 0; i < data.length; i += 180) await ch.writeValue(data.slice(i, i + 180)); // BLE packet size
      await logJob(orderId, kind, 'escpos', 'bluetooth', 'done');
      setMsg('✓');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      await logJob(orderId, kind, 'escpos', 'bluetooth', 'failed', String(e));
    }
  };

  const lan = async () => {
    const r = await logJob(orderId, kind, thermal ?? '80mm', 'lan', 'queued');
    setMsg(r.error ? r.error : labels.queued);
  };

  if (blocked) return <p className="no-print rounded-xl bg-danger-500/10 p-3 text-sm text-danger-500">{labels.reprintDenied}</p>;
  return (
    <div className="no-print mx-auto mb-6 flex max-w-xl flex-wrap justify-center gap-2">
      <button type="button" className="btn btn-primary" onClick={() => window.print()} data-testid="print-browser"><Printer className="size-4" /> {labels.browser}</button>
      {thermal && <button type="button" className="btn btn-ghost" onClick={usb}><Usb className="size-4" /> {labels.usb}</button>}
      {thermal && <button type="button" className="btn btn-ghost" onClick={bluetooth}><Bluetooth className="size-4" /> {labels.bt}</button>}
      {thermal && <button type="button" className="btn btn-ghost" onClick={lan}><Network className="size-4" /> {labels.lan}</button>}
      {msg && <p className="w-full text-center text-sm" role="status">{msg}</p>}
    </div>
  );
}
