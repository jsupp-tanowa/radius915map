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
let userLocation = null;
let currentMarker = null;

/* 現在地 */
function moveToCurrentLocation() {
  if (!navigator.geolocation) {
    alert("位置情報が使えません");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const currentPos = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      userLocation = currentPos;

      map.setCenter(currentPos);
      map.setZoom(14);

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

/* 距離計算 */
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* クローズ処理 */
document.getElementById("closeCardBtn").addEventListener("click", () => {
  const card = document.getElementById("shopCard");
  card.classList.remove("open");
  card.style.display = "none";
});

/* 地図初期化 */
window.initMap = function () {

  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 34.7284, lng: 135.4814 },
    zoom: 16
  });

  /* bottom-sheet スワイプ */
  const card = document.getElementById("shopCard");
  let startY = 0;

  card.addEventListener("touchstart", e => {
    startY = e.touches[0].clientY;
  });

  card.addEventListener("touchend", e => {
    const endY = e.changedTouches[0].clientY;
    const diff = startY - endY;

    if (diff > 50) card.classList.add("open");
    if (diff < -50) {
      card.classList.remove("open");
      setTimeout(() => {
        card.style.display = "none";
      }, 300);
    }
  });

  /* ▼▼▼ ここから検索対応の正しい構造 ▼▼▼ */

  let allShops = [];
  let markers = [];

  function createMarker(shop) {
    const marker = new google.maps.Marker({
      position: { lat: Number(shop.lat), lng: Number(shop.lng) },
      map: map,
      title: shop.name
    });

    marker.addListener("click", () => {
      card.style.display = "block";

      document.getElementById("shopName").innerText = shop.name;
      document.getElementById("shopInfo").innerHTML =
        `応援: ${shop.team}<br>` +
        `ジャンル: ${shop.genre || ""}<br>` +
        `${shop.note || ""}`;
      document.getElementById("shopImage").src =
        shop.image || "https://picsum.photos/600/300";

      document.querySelector(".detail-btn").onclick = () => {
        const googleMapLink = `https://www.google.com/maps?q=${shop.lat},${shop.lng}`;
        window.open(googleMapLink, "_blank");
      };
    });

    markers.push(marker);
  }

function loadShops() {
  db.collection("shops").get().then(snapshot => {
    allShops = [];
    markers.forEach(m => m.setMap(null));
    markers = [];

    snapshot.forEach(doc => {
      const shop = doc.data();
      allShops.push(shop);
      createMarker(shop);
    });

    // ★ ロード完了後に検索イベントを登録（ここが重要）
    setupSearch();
  });
}

function setupSearch() {
  const input = document.getElementById("searchInput");

  // すでにイベントが付いている場合は解除
  input.oninput = null;

  input.addEventListener("input", e => {
    const keyword = e.target.value.trim();

    markers.forEach(m => m.setMap(null));
    markers = [];

    if (keyword === "") {
      allShops.forEach(shop => createMarker(shop));
      return;
    }

    const filtered = allShops.filter(shop =>
      (shop.name && shop.name.includes(keyword)) ||
      (shop.team && shop.team.includes(keyword)) ||
      (shop.genre && shop.genre.includes(keyword)) ||
      (shop.note && shop.note.includes(keyword))
    );

    filtered.forEach(shop => createMarker(shop));
  });
}

  /* 検索バー */
  document.getElementById("searchInput").addEventListener("input", e => {
    const keyword = e.target.value.trim();

    markers.forEach(m => m.setMap(null));
    markers = [];

    if (keyword === "") {
      allShops.forEach(shop => createMarker(shop));
      return;
    }

    const filtered = allShops.filter(shop =>
      (shop.name && shop.name.includes(keyword)) ||
      (shop.team && shop.team.includes(keyword)) ||
      (shop.genre && shop.genre.includes(keyword)) ||
      (shop.note && shop.note.includes(keyword))
    );

    filtered.forEach(shop => createMarker(shop));
  });

  /* 初回ロード */
  loadShops();
};
