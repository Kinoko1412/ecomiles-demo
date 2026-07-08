export type PartnerMerchant = {
  id: string;
  name: string;
  category: string;
  photo: string;
  description: string;
  googleMapsUrl: string;
};

export const PARTNER_MERCHANTS: PartnerMerchant[] = [
  {
    id: "hui-you-ba",
    name: "洄遊吧食魚體驗館",
    category: "食魚教育",
    photo: "/shop/洄遊吧食魚體驗館.jpg",
    description: "以海洋保育與食魚文化為主題的體驗館，提供永續海鮮知識與互動導覽。",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("洄遊吧食魚體驗館 花蓮"),
  },
  {
    id: "qixing-katsuo",
    name: "七星柴魚博物館",
    category: "地方文化",
    photo: "/shop/七星柴魚博物館.jpg",
    description: "花蓮在地柴魚產業歷史展示館，近距離了解傳統柴魚製作工藝與海洋文化。",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("七星柴魚博物館 花蓮"),
  },
];
