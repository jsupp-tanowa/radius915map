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
    zoom: 16,
    mapTypeControl: false
  });

  let allShops = [];
  let markers = [];
  let showGeneral = false; // 一般店舗(supportLevel=0)の表示フラグ

  /* マーカー作成：ピン色は赤に統一 */
  function createMarker(shop) {
    const marker = new google.maps.Marker({
      position: { lat: Number(shop.lat), lng: Number(shop.lng) },
      map: map,
      title: shop.name,
      icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
    });

    marker.addListener("click", () => {
      const card = document.getElementById("shopCard");
      card.style.display = "block";

      document.getElementById("shopName").innerText = shop.name;

      const isSupporter = shop.supportLevel !== 0;

      // ② supportLevel!=0 のときのみ team/note を表示
      const teamLine = (isSupporter && shop.team) ? `推しクラブ: ${shop.team}<br>` : "";
      const noteLine = (isSupporter && shop.note) ? `${shop.note}` : "";

      document.getElementById("shopInfo").innerHTML =
        teamLine +
        `ジャンル: ${shop.genre || ""}<br>` +
        noteLine;

      // ② supportLevel!=0 かつ image あり のときのみ画像を表示
      const imgEl = document.getElementById("shopImage");
      if (isSupporter && shop.image) {
        imgEl.src = shop.image;
        imgEl.style.display = "block";
      } else {
        imgEl.src = "";
        imgEl.style.display = "none";
      }

      document.querySelector(".detail-btn").onclick = () => {
        const googleMapLink =
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name)}&query_place_id=${shop.placeid}`;
        window.open(googleMapLink, "_blank");
      };
    });

    markers.push(marker);
  }

  /* 表示対象を絞り込んでマーカーを再描画 */
  function refreshMarkers() {
    markers.forEach(m => m.setMap(null));
    markers = [];

    const keyword = document.getElementById("searchInput").value.trim();

    const visible = allShops.filter(shop => {
      // ① published=true のみ表示
      if (!shop.published) return false;
      // supportLevel=0 は showGeneral が true のときのみ表示
      if (shop.supportLevel === 0 && !showGeneral) return false;
      // 検索フィルター
      if (keyword) {
        return (
          (shop.name && shop.name.includes(keyword)) ||
          (shop.team && shop.team.includes(keyword)) ||
          (shop.genre && shop.genre.includes(keyword)) ||
          (shop.note && shop.note.includes(keyword))
        );
      }
      return true;
    });

    visible.forEach(shop => createMarker(shop));
  }

  /* 一般店舗タブ：ON/OFFトグル */
  const generalTab = document.getElementById("generalTab");
  generalTab.addEventListener("click", () => {
    showGeneral = !showGeneral;
    generalTab.style.opacity = showGeneral ? "1" : "0.5";
    refreshMarkers();
  });
  // 初期状態はOFF（薄く表示）
  generalTab.style.opacity = "0.5";

  /* 検索タブ */
  const searchTab = document.getElementById("searchTab");
  const searchBar = document.querySelector(".search-bar");

  searchTab.addEventListener("click", () => {
    searchBar.classList.toggle("open");
  });

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
        if (shop.published) {
          bounds.extend(new google.maps.LatLng(Number(shop.lat), Number(shop.lng)));
        }
      });

      refreshMarkers();

      if (!snapshot.empty) {
        map.fitBounds(bounds);
        google.maps.event.addListenerOnce(map, "bounds_changed", () => {
          if (map.getZoom() > 14) map.setZoom(14);
        });
      }
    });
  }

  /* 検索バー */
  document.getElementById("searchInput").addEventListener("input", () => {
    refreshMarkers();
  });

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
