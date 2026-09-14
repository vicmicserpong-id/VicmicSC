import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    skipWaiting: true,
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Semua foto yang ditampilkan (unit servis, logo) sudah pas ukuran & formatnya
    // (dikompres WebP <=1280px di klien sebelum unggah) -- optimisasi server Vercel
    // tidak menambah manfaat, cuma memakai kuota "Image Optimization" (5rb/bulan
    // di paket gratis). Matikan supaya next/image langsung serve apa adanya.
    unoptimized: true,
    remotePatterns: [
      // Supabase Storage — foto lama, dari sebelum pindah ke vicmic-file-server
      {
        protocol: "https",
        hostname: "tmgivkpadfixkhkxltup.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // vicmic-file-server di hosting Exabytes — subdomain apa pun di vicmic.id
      // (mis. files.vicmic.id, foto.vicmic.id) menyimpan foto unit servis.
      {
        protocol: "https",
        hostname: "*.vicmic.id",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default withPWA(nextConfig);
