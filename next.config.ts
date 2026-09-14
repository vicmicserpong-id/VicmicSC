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
