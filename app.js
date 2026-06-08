/* Firebase */
const firebaseConfig = {
  apiKey: "AIzaSyCyzwwPiCcUCICxv6kcx7ZlaNkMa46hcVA",
  authDomain: "japan-football-supporters-hub.firebaseapp.com",
  projectId: "japan-football-supporters-hub",
  storageBucket: "japan-football-supporters-hub.firebasestorage.app",
  messagingSenderId: "607581916231",
  appId: "1:607581916231:web:d857fe57f315dea46db562"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let map;
let userLocation  = null;
let currentMarker = null;

/* ⑦ ひらがな↔カタカナ相互変換ユーティリティ */
function toHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}
function toKatakana(str) {
  return str.replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}
/** キーワードを正規化し、ひらがな・カタカナどちらでもヒットするよう両形を返す */
function normalizeKeyword(kw) {
  return [kw, toHiragana(kw), toKatakana(kw)];
}
/** フィールド値がキーワード（いずれかの形）を含むか */
function matchField(field, variants) {
  if (!field) return false;
  return variants.some(v => field.includes(v));
}

/* 現在地ボタン */
function moveToCurrentLocation() {
  if (!navigator.geolocation) {
    alert("位置情報が使えません");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const currentPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      userLocation = currentPos;
      map.setCenter(currentPos);
      map.setZoom(11);
      if (currentMarker) currentMarker.setMap(null);
      currentMarker = new google.maps.Marker({
        position: currentPos,
        map: map,
        title: "現在地",
        icon: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
      });
    },
    () => alert("位置情報の取得に失敗しました")
  );
}

/* 地図初期化 */
window.initMap = function () {

  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 34.7284, lng: 135.4814 },
    zoom: 11,
    mapTypeControl:    false,
    zoomControl:       false,  // ①±ボタン非表示
    streetViewControl: false,  // ①ストリートビュー非表示
    fullscreenControl: false   // ①フルスクリーンボタン非表示
  });

  /* ── データ ── */
  let allShops    = [];
  let allStadiums = [];

  /* ── マーカー管理 ── */
  let shopMarkers    = [];
  let stadiumMarkers = [];

  /* ── 表示フラグ ── */
  let showGeneral  = false; // 一般店舗(supportLevel=0)
  let showStadiums = true;  // ③スタジアム 初期ON

  /* ── カード共通処理 ── */
  function openCard() {
    const card = document.getElementById("shopCard");
    card.style.display = "block";
  }
  function closeCard() {
    const card = document.getElementById("shopCard");
    card.classList.remove("open");
    card.style.display = "none";
  }

  /* ── ② スタジアムマーカー作成（緑ピン） ── */
  function createStadiumMarker(stadium) {
    const marker = new google.maps.Marker({
      position: { lat: Number(stadium.lat), lng: Number(stadium.lng) },
      map: map,
      title: stadium.name,
      icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
    });

    marker.addListener("click", () => {
      openCard();

      // ⑤ カード表示：name + teams
      document.getElementById("shopName").innerText = stadium.name;
      const teamsText = Array.isArray(stadium.teams) && stadium.teams.length
        ? `ホームクラブ: ${stadium.teams.join(" / ")}`
        : "";
      document.getElementById("shopInfo").innerHTML = teamsText;

      // 画像は非表示
      const imgEl = document.getElementById("shopImage");
      imgEl.src = "";
      imgEl.style.display = "none";

      // 詳細ボタン → Googleマップ
      document.querySelector(".detail-btn").onclick = () => {
        const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stadium.name)}&query_place_id=${stadium.placeid}`;
        window.open(link, "_blank");
      };

      // ④ radiusに応じてズーム
      // radius(km) → zoom: 1km≒15, 2km≒14, 3km≒13, 5km≒12
      const r = Number(stadium.radius) || 3;
      const zoom = r <= 1 ? 15 : r <= 2 ? 14 : r <= 3 ? 13 : r <= 5 ? 12 : 11;
      map.setCenter({ lat: Number(stadium.lat), lng: Number(stadium.lng) });
      map.setZoom(zoom);
    });

    stadiumMarkers.push(marker);
  }

  /* ── 店舗マーカー作成 ── */
  function createShopMarker(shop) {
    const isSupporter = shop.supportLevel !== 0;
    const marker = new google.maps.Marker({
      position: { lat: Number(shop.lat), lng: Number(shop.lng) },
      map: map,
      title: shop.name,
      icon: isSupporter
        ? "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        : "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
    });

    marker.addListener("click", () => {
      openCard();
      document.getElementById("shopName").innerText = shop.name;

      const teamLine = (isSupporter && shop.team) ? `推しクラブ: ${shop.team}<br>` : "";
      const noteLine = (isSupporter && shop.note) ? `${shop.note}` : "";
      document.getElementById("shopInfo").innerHTML =
        teamLine + `カテゴリー: ${shop.category || ""}<br>` + noteLine;

      const imgEl = document.getElementById("shopImage");
      if (isSupporter && shop.image) {
        imgEl.src = shop.image;
        imgEl.style.display = "block";
      } else {
        imgEl.src = "";
        imgEl.style.display = "none";
      }

      document.querySelector(".detail-btn").onclick = () => {
        const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name)}&query_place_id=${shop.placeid}`;
        window.open(link, "_blank");
      };
    });

    shopMarkers.push(marker);
  }

  /* ── 店舗マーカー再描画 ── */
  function refreshShopMarkers() {
    shopMarkers.forEach(m => m.setMap(null));
    shopMarkers = [];

    const keyword  = document.getElementById("searchInput").value.trim();
    const variants = keyword ? normalizeKeyword(keyword) : [];

    allShops.filter(shop => {
      if (!shop.published) return false;
      if (shop.supportLevel === 0 && !showGeneral) return false;
      if (variants.length) {
        return (
          matchField(shop.name,     variants) ||
          matchField(shop.team,     variants) ||
          matchField(shop.category, variants) ||
          matchField(shop.note,     variants)
        );
      }
      return true;
    }).forEach(shop => createShopMarker(shop));
  }

  /* ── ⑥ スタジアムマーカー再描画（検索対応） ── */
  function refreshStadiumMarkers() {
    stadiumMarkers.forEach(m => m.setMap(null));
    stadiumMarkers = [];

    if (!showStadiums) return;

    const keyword  = document.getElementById("searchInput").value.trim();
    const variants = keyword ? normalizeKeyword(keyword) : [];

    allStadiums.filter(s => {
      if (variants.length) {
        const teamsStr = Array.isArray(s.teams) ? s.teams.join(" ") : (s.teams || "");
        return (
          matchField(s.name,    variants) ||
          matchField(s.subname, variants) ||
          matchField(teamsStr,  variants)
        );
      }
      return true;
    }).forEach(s => createStadiumMarker(s));
  }

  function refreshAllMarkers() {
    refreshShopMarkers();
    refreshStadiumMarkers();
  }

  /* ── タブ：一般店舗 ── */
  const generalTab = document.getElementById("generalTab");
  generalTab.addEventListener("click", () => {
    showGeneral = !showGeneral;
    generalTab.style.opacity = showGeneral ? "1" : "0.5";
    refreshShopMarkers();
  });
  generalTab.style.opacity = "0.5";

  /* ── ③ タブ：スタジアム（初期ON） ── */
  const stadiumTab = document.getElementById("stadiumTab");
  stadiumTab.addEventListener("click", () => {
    showStadiums = !showStadiums;
    stadiumTab.style.opacity = showStadiums ? "1" : "0.5";
    refreshStadiumMarkers();
  });
  stadiumTab.style.opacity = "1"; // 初期ON

  /* ── 検索タブ ── */
  const searchTab = document.getElementById("searchTab");
  const searchBar = document.querySelector(".search-bar");
  searchTab.addEventListener("click", () => {
    searchBar.classList.toggle("open");
  });

  /* ── 検索バー入力 ── */
  document.getElementById("searchInput").addEventListener("input", () => {
    refreshAllMarkers();
  });

  /* ── データ読込 ── */
  function loadShops() {
    db.collection("shops").get().then(snapshot => {
      allShops = [];
      snapshot.forEach(doc => allShops.push(doc.data()));
      refreshShopMarkers();
    });
  }

  function loadStadiums() {
    db.collection("stadiums").get().then(snapshot => {
      allStadiums = [];
      snapshot.forEach(doc => allStadiums.push(doc.data()));
      refreshStadiumMarkers();
    });
  }

  /* ── カード閉じる ── */
  document.getElementById("closeCardBtn").addEventListener("click", closeCard);

  /* ── bottom-sheet スワイプ ── */
  const card = document.getElementById("shopCard");
  let startY = 0;
  card.addEventListener("touchstart", e => { startY = e.touches[0].clientY; });
  card.addEventListener("touchend", e => {
    const diff = startY - e.changedTouches[0].clientY;
    if (diff > 50) card.classList.add("open");
    if (diff < -50) {
      card.classList.remove("open");
      setTimeout(() => { card.style.display = "none"; }, 300);
    }
  });

  /* ── 初期位置情報取得 ── */
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const currentPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocation = currentPos;
        map.setCenter(currentPos);
        map.setZoom(11);
        if (currentMarker) currentMarker.setMap(null);
        currentMarker = new google.maps.Marker({
          position: currentPos,
          map: map,
          title: "現在地",
          icon: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
        });
      },
      () => {},
      { timeout: 8000 }
    );
  }

  /* ── 初回ロード ── */
  loadShops();
  loadStadiums();
};
