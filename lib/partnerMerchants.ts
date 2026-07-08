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
  {
    id: "qiancao-tang",
    name: "淺草堂（花蓮門市）",
    category: "伴手禮 / 地方特產",
    photo: "/shop/淺草堂（花蓮門市）.jpg",
    description:
      "這是一間專注於花蓮在地農產品開發的店家，以純天然、無添加的理念，運用在地原料製作各式加工食品。門市提供多種風味獨特的農產加工品，是許多遊客選購在地健康伴手禮的熱門選擇。",
    googleMapsUrl: "https://maps.app.goo.gl/Fka7jBf1pnKERZ4e6",
  },
  {
    id: "jincai-meiguishi",
    name: "金彩玫瑰石博物館",
    category: "地方文化 / 藝文展覽",
    photo: "/shop/金彩玫瑰石博物館.jpg",
    description:
      "玫瑰石是花蓮極具代表性的寶石，此博物館致力於收藏與展示各式精美的玫瑰石藝術品。館內呈現了台灣東部特有的礦石文化，遊客可以欣賞到經過精雕細琢的玫瑰石藝品，深度了解花蓮的礦石藝術產業。",
    googleMapsUrl: "https://maps.app.goo.gl/WorGRRsk1KfPvY9H9",
  },
  {
    id: "jian-qingxiuyuan",
    name: "吉安慶修院",
    category: "歷史古蹟 / 觀光景點",
    photo: "/shop/吉安慶修院.jpg",
    description:
      "這是一座擁有百年歷史的日式古蹟，由早期的日本移民所建。園區內保留了極具東洋風情的建築風格、石佛與庭園，是台灣保存最完整的日治時期神社遺址之一，充滿寧靜且濃厚的歷史人文氛圍。",
    googleMapsUrl: "https://maps.app.goo.gl/BXgmAAUY87pQkBsg8",
  },
  {
    id: "haowu-fenxiangguan",
    name: "花蓮好物分享館",
    category: "伴手禮 / 在地選物",
    photo: "/shop/花蓮好物分享館.jpg",
    description:
      "這是一間匯集花蓮在地優質產品的選物空間，以「分享」為核心理念，搜羅了許多在地創作者、小農的心血結晶，產品種類豐富，提供遊客一個可以一次認識並購得花蓮多樣化優質好物的平台。",
    googleMapsUrl: "https://maps.app.goo.gl/bJwiBGpfukLgmagq7",
  },
];
