import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/images/coworking_spaces.webp" },
      { pathname: "/images/private_offices.webp" },
      { pathname: "/images/meeting_rooms.webp" },
      { pathname: "/images/hot_desks.webp" },
      { pathname: "/images/Casablanca.webp" },
      { pathname: "/images/rabat.webp" },
      { pathname: "/images/marrakech.webp" },
      { pathname: "/images/tangier.webp" },
      { pathname: "/images/howItWorks_discover.webp" },
      { pathname: "/images/howItWorks_choose.webp" },
      { pathname: "/images/howItWorks_bookAndPay.webp" },
      { pathname: "/images/heroSection.png" },
      { pathname: "/images/heroImage.webp" },
      { pathname: "/images/login_image.webp" },
      { pathname: "/images/register_Image.webp" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
