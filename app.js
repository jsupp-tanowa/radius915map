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

      loadShops();
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

/* 店舗読込 */
function loadShops() {
  db.collection("shops").get().then(snapshot => {
    const bounds = new google.maps.LatLngBounds();

    snapshot.forEach(doc => {
      const shop = doc.data();

      let distanceText = "";
      if (userLocation) {
        const distance = getDistance(
          userLocation.lat,
          userLocation.lng,
          Number(shop.lat),
          Number(shop.lng)
        );
        distanceText = `距離: ${distance.toFixed(2)} km<br>`;
      }

      const iconColor = shop.away
        ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
        : "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";

      const marker = new google.maps.Marker({
        position: { lat: Number(shop.lat), lng: Number(shop.lng) },
        map: map,
        title: shop.name,
        icon: iconColor
      });

      bounds.extend(marker.getPosition());

      marker.addListener("click", () => {
        document.getElementById("shopCard").style.display = "block";
        document.getElementById("shopName").innerText = shop.name;
        document.getElementById("shopInfo").innerHTML =
          `応援: ${shop.team}<br>` +
          `ジャンル: ${shop.genre || ""}<br>` +
          `${shop.note || ""}`;
        document.getElementById("shopImage").src =
          shop.image || "https://picsum.photos/600/300";
        // ★ 詳細を見るボタンの動作を設定
　　　  document.querySelector(".detail-btn").onclick = () => {
    　　　const googleMapLink = `https://www.google.com/maps?q=${shop.lat},${shop.lng}`;
    　　　window.open(googleMapLink, "_blank");
  　　　};
      });
    });

    if (!snapshot.empty) {
      map.fitBounds(bounds);
      google.maps.event.addListenerOnce(map, "bounds_changed", () => {
        if (map.getZoom() > 14) map.setZoom(14);
      });
    }
  });
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

  loadShops();

  /* bottom-sheet スワイプ */
  const card = document.getElementById("shopCard");
  let startY = 0;

  card.addEventListener("touchstart", e => {
    startY = e.touches[0].clientY;
  });

  card.addEventListener("touchend", e => {
    const endY = e.changedTouches[0].clientY;
    const diff = startY - endY;

    // 上へスワイプ → 開く
    if (diff > 50) {
      card.classList.add("open");
    }

    // 下へスワイプ → 閉じる
    if (diff < -50) {
      card.classList.remove("open");
      setTimeout(() => {
        card.style.display = "none";
      }, 300);
    }
  });
  let allShops = [];   // 全店舗データを保持
  let markers = [];    // 現在表示中のマーカー
  
  function loadShops() {
    db.collection("shops").get().then(snapshot => {
      allShops = [];  // 初期化
      markers.forEach(m => m.setMap(null)); // 既存マーカー削除
      markers = [];

      snapshot.forEach(doc => {
        const shop = doc.data();
        allShops.push(shop);
        createMarker(shop);
      });
    });
  }

  function createMarker(shop) {
    const marker = new google.maps.Marker({
      position: { lat: shop.lat, lng: shop.lng },
      map: map,
      title: shop.name
    });

    marker.addListener("click", () => {
      const card = document.getElementById("shopCard");
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
  document.getElementById("searchInput").addEventListener("input", e => {
  const keyword = e.target.value.trim();

  // マーカーを全部消す
  markers.forEach(m => m.setMap(null));
  markers = [];

  // キーワードが空 → 全部表示
  if (keyword === "") {
    allShops.forEach(shop => createMarker(shop));
    return;
  }

  // フィルタ
  const filtered = allShops.filter(shop =>
    (shop.name && shop.name.includes(keyword)) ||
    (shop.team && shop.team.includes(keyword)) ||
    (shop.genre && shop.genre.includes(keyword)) ||
    (shop.note && shop.note.includes(keyword))
  );

  // 該当店舗だけ表示
  filtered.forEach(shop => createMarker(shop));
});
};
