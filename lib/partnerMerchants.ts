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
    description:
      "一處結合環境教育與食魚文化的體驗館。洄游吧致力於推廣永續海洋的觀念，透過生動的展覽與課程，讓遊客認識台灣東部的海域環境與洄游魚類。",
    googleMapsUrl: "https://maps.app.goo.gl/Jdw9yXytcoqx19588",
  },
  {
    id: "qixing-katsuo",
    name: "七星柴魚博物館",
    category: "地方文化",
    photo: "/shop/七星柴魚博物館.jpg",
    description:
      "博物館由舊有的柴魚工廠改建而成，是認識花蓮在地漁村歷史與柴魚製作工藝的重要據點。",
    googleMapsUrl: "https://maps.app.goo.gl/C7caUxtBDM7TEyrG9",
  },
];
