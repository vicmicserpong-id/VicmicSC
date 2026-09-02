import { QrScanner } from "@/components/shared/qr-scanner";

export const metadata = { title: "Scan QR" };

export default function AdminScanPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Scan QR</h1>
        <p className="text-sm text-muted-foreground">
          Scan QR di label unit untuk langsung membuka detail tiketnya.
        </p>
      </div>
      <QrScanner />
    </div>
  );
}
