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

/* 地図初期化 */
window.initMap = function () {

  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 34.7284, lng: 135.4814 },
    zoom: 16
    mapTypeControl:false
  });
/*
  let allShops = [];
  let markers = [];
*/
  /* マーカー作成 */
  function createMarker(shop) {
    const marker = new google.maps.Marker({
      position: { lat: Number(shop.lat), lng: Number(shop.lng) },
      map: map,
      title: shop.name,
      icon: shop.away
        ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
        : "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
    });

    marker.addListener("click", () => {
      const card = document.getElementById("shopCard");
      card.style.display = "block";

      document.getElementById("shopName").innerText = shop.name;
      document.getElementById("shopInfo").innerHTML =
        `推しクラブ: ${shop.team}<br>` +
        `ジャンル: ${shop.genre || ""}<br>` +
        `${shop.note || ""}`;
      document.getElementById("shopImage").src =
        shop.image || "https://picsum.photos/600/300";

      document.querySelector(".detail-btn").onclick = () => {
        const googleMapLink =
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name)}&query_place_id=${shop.placeId}`;
        window.open(googleMapLink, "_blank");
      };
    });

    markers.push(marker);
  }

  /* 店舗読込 */
  function loadShops() {
    db.collection("shops").get().then(snapshot => {
      const bounds = new google.maps.LatLngBounds();

      allShops = [];
      markers.forEach(m => m.setMap(null));
      markers = [];

      snapshot.forEach(doc => {
        const shop = doc.data();
        allShops.push(shop);
        createMarker(shop);
        bounds.extend(new google.maps.LatLng(Number(shop.lat), Number(shop.lng)));
      });

      if (!snapshot.empty) {
        map.fitBounds(bounds);
        google.maps.event.addListenerOnce(map, "bounds_changed", () => {
          if (map.getZoom() > 14) map.setZoom(14);
        });
      }
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


  /* ジャンルボタン検索
　document.querySelectorAll(".filter-area button").forEach(btn => {
  　btn.addEventListener("click", () => {
    　const genre = btn.innerText.trim();

    　markers.forEach(m => m.setMap(null));
    　markers = [];

    　const filtered = allShops.filter(shop =>
      　shop.genre && shop.genre.includes(genre)
    　);

    　filtered.forEach(shop => createMarker(shop));
  　});
　});
　*/


  /* カード閉じる */
  document.getElementById("closeCardBtn").addEventListener("click", () => {
    const card = document.getElementById("shopCard");
    card.classList.remove("open");
    card.style.display = "none";
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
  /* 初回ロード */
  loadShops();
};
