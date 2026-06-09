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

/* ひらがな↔カタカナ・大文字小文字 */
function toHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
function toKatakana(str) {
  return str.replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60));
}
function normalizeKeyword(kw) {
  const lower = kw.toLowerCase();
  return [lower, toHiragana(lower), toKatakana(lower)];
}
function matchField(field, variants) {
  if (!field) return false;
  const f = field.toLowerCase();
  return variants.some(v => f.includes(v));
}

/* 現在地ボタン */
function moveToCurrentLocation() {
  if (!navigator.geolocation) { alert("位置情報が使えません"); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      userLocation = p;
      map.setCenter(p);
      map.setZoom(11);
      if (currentMarker) currentMarker.setMap(null);
      currentMarker = new google.maps.Marker({
        position: p, map, title: "現在地",
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
    zoomControl:       false,
    streetViewControl: false,
    fullscreenControl: false
  });

  let allShops    = [];
  let allStadiums = [];
  let shopMarkers    = [];
  let stadiumMarkers = [];
  let showGeneral  = false;
  let showStadiums = true;

  /* ⑤ 経路検索先（現在表示中のカードのplaceid・name） */
  let currentDestination = null; // { placeid, name, lat, lng }

  /* ── カード ── */
  function openCard() {
    document.getElementById("shopCard").style.display = "block";
  }
  function closeCard() {
    const card = document.getElementById("shopCard");
    card.classList.remove("open");
    card.style.display = "none";
    // ④ カードを閉じたら経路検索ボタンを無効化
    setRouteTabEnabled(false);
    currentDestination = null;
  }

  /* ④ 経路検索タブの有効/無効切替 */
  const routeTab = document.getElementById("routeTab");
  function setRouteTabEnabled(enabled) {
    if (enabled) {
      routeTab.classList.remove("tab-disabled");
      routeTab.style.opacity = "1";
    } else {
      routeTab.classList.add("tab-disabled");
      routeTab.style.opacity = "0.4";
    }
  }
  setRouteTabEnabled(false); // 初期は無効

  /* ⑤ 経路検索実行 */
  routeTab.addEventListener("click", () => {
    if (!currentDestination) return;

    const dest = `place_id:${currentDestination.placeid}`;
    const origin = userLocation
      ? `${userLocation.lat},${userLocation.lng}`
      : "";

    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=transit`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=transit`;

    window.open(url, "_blank");
  });

  /* ── 検索バー クリアボタン ── */
  const searchInput    = document.getElementById("searchInput");
  const searchClearBtn = document.getElementById("searchClearBtn");

  function updateClearBtn() {
    searchClearBtn.style.display = searchInput.value.length > 0 ? "block" : "none";
  }
  searchClearBtn.addEventListener("click", () => {
    clearSearch();
  });
  function clearSearch() {
    searchInput.value = "";
    updateClearBtn();
  }

  /* ── fitBounds（stadium検索用） ── */
  function fitToMarkers(markers) {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setCenter(markers[0].getPosition());
      map.setZoom(13);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    markers.forEach(m => bounds.extend(m.getPosition()));
    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, "bounds_changed", () => {
      if (map.getZoom() > 14) map.setZoom(14);
    });
  }

  /* ── スタジアムマーカー作成 ── */
  function createStadiumMarker(stadium) {
    const marker = new google.maps.Marker({
      position: { lat: Number(stadium.lat), lng: Number(stadium.lng) },
      map,
      title: stadium.name,
      icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
    });

    marker.addListener("click", () => {
      openCard();

      // ① subname優先、なければname
      const displayName = (stadium.subname && stadium.subname.trim())
        ? stadium.subname : stadium.name;
      document.getElementById("shopName").innerText = displayName;

      const teamsText = Array.isArray(stadium.teams) && stadium.teams.length
        ? `ホームクラブ: ${stadium.teams.join(" / ")}` : "";
      document.getElementById("shopInfo").innerHTML = teamsText;

      const imgEl = document.getElementById("shopImage");
      imgEl.src = ""; imgEl.style.display = "none";

      // 詳細ボタン → Googleマップ
      document.querySelector(".detail-btn").onclick = () => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stadium.name)}&query_place_id=${stadium.placeid}`, "_blank");
      };

      // radiusに応じてズーム
      const r = Number(stadium.radius) || 3;
      const zoom = r <= 1 ? 15 : r <= 2 ? 14 : r <= 3 ? 13 : r <= 5 ? 12 : 11;
      map.setCenter({ lat: Number(stadium.lat), lng: Number(stadium.lng) });
      map.setZoom(zoom);

      // ④ 経路検索ボタン有効化
      currentDestination = {
        placeid: stadium.placeid,
        name: displayName,
        lat: Number(stadium.lat),
        lng: Number(stadium.lng)
      };
      setRouteTabEnabled(true);
    });

    stadiumMarkers.push(marker);
    return marker;
  }

  /* ── 店舗マーカー作成 ── */
  function createShopMarker(shop) {
    const isSupporter = shop.supportLevel !== 0;
    const marker = new google.maps.Marker({
      position: { lat: Number(shop.lat), lng: Number(shop.lng) },
      map,
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
        teamLine + `ジャンル: ${shop.category || ""}<br>` + noteLine;

      const imgEl = document.getElementById("shopImage");
      if (isSupporter && shop.image) {
        imgEl.src = shop.image; imgEl.style.display = "block";
      } else {
        imgEl.src = ""; imgEl.style.display = "none";
      }

      document.querySelector(".detail-btn").onclick = () => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name)}&query_place_id=${shop.placeid}`, "_blank");
      };

      // ④ 経路検索ボタン有効化
      currentDestination = {
        placeid: shop.placeid,
        name: shop.name,
        lat: Number(shop.lat),
        lng: Number(shop.lng)
      };
      setRouteTabEnabled(true);
    });

    shopMarkers.push(marker);
    return marker;
  }

  /* ── 店舗マーカー再描画 ── */
  function refreshShopMarkers() {
    shopMarkers.forEach(m => m.setMap(null));
    shopMarkers = [];

    const keyword  = searchInput.value.trim();
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

  /* ── スタジアムマーカー再描画 ── */
  function refreshStadiumMarkers() {
    stadiumMarkers.forEach(m => m.setMap(null));
    stadiumMarkers = [];

    if (!showStadiums) return;

    const keyword  = searchInput.value.trim();
    const variants = keyword ? normalizeKeyword(keyword) : [];

    const filtered = allStadiums.filter(s => {
      if (variants.length) {
        const teamsStr = Array.isArray(s.teams) ? s.teams.join(" ") : (s.teams || "");
        return (
          matchField(s.name,       variants) ||
          matchField(s.subname,    variants) ||
          matchField(s.prefecture, variants) ||
          matchField(teamsStr,     variants)
        );
      }
      return true;
    });

    filtered.forEach(s => createStadiumMarker(s));

    // stadium検索時のみfitBounds
    if (variants.length && stadiumMarkers.length > 0) fitToMarkers(stadiumMarkers);
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
    clearSearch();
    refreshShopMarkers();
  });
  generalTab.style.opacity = "0.5";

  /* ── タブ：スタジアム ── */
  const stadiumTab = document.getElementById("stadiumTab");
  stadiumTab.addEventListener("click", () => {
    showStadiums = !showStadiums;
    stadiumTab.style.opacity = showStadiums ? "1" : "0.5";
    clearSearch();
    refreshStadiumMarkers();
  });
  stadiumTab.style.opacity = "1";

  /* ── 検索バー入力 ── */
  searchInput.addEventListener("input", () => {
    updateClearBtn();
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
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocation = p;
        map.setCenter(p);
        map.setZoom(11);
        if (currentMarker) currentMarker.setMap(null);
        currentMarker = new google.maps.Marker({
          position: p, map, title: "現在地",
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
