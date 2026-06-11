/* Firebase */
const firebaseConfig = {
  apiKey: "AIzaSyCyzwwPiCcUCICxv6kcx7ZlaNkMa46hcVA",,
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
  return variants.some(v => field.toLowerCase().includes(v));
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
      // ①現在地取得時に出発地を自動セット
      setOrigin({ lat: p.lat, lng: p.lng, name: "現在地" });
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

  let allShops       = [];
  let allStadiums    = [];
  let shopMarkers    = [];
  let stadiumMarkers = [];
  let showGeneral    = false;
  let showStadiums   = true;
  let hadStadiumResults = false; // ③前回stadium検索ヒットフラグ

  /* ── ①② 出発地管理 ── */
  let originData = null; // { lat, lng, name }

  const setOriginChk = document.getElementById("setOriginChk");

  // 出発地をセット（現在地取得時などに外部から呼ぶ）
  window.setOrigin = function(data) {
    originData = data;
    if (setOriginChk) setOriginChk.checked = true;
  };

  // チェックボックスON→出発地セット、OFF→クリア
  setOriginChk.addEventListener("change", () => {
    if (setOriginChk.checked && currentDestination) {
      originData = {
        lat:  currentDestination.lat,
        lng:  currentDestination.lng,
        name: currentDestination.name
      };
    } else {
      originData = null;
    }
  });

  /* ── 経路検索先 ── */
  let currentDestination = null;

  /* ── カード ── */
  function openCard() {
    document.getElementById("shopCard").style.display = "block";
  }
  function closeCard() {
    const card = document.getElementById("shopCard");
    card.classList.remove("open");
    card.style.display = "none";
    setRouteTabEnabled(false);
    currentDestination = null;
    if (setOriginChk) setOriginChk.checked = false;
  }

  /* ④ 経路検索タブ有効/無効 */
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
  setRouteTabEnabled(false);

  /* 経路検索実行 */
  routeTab.addEventListener("click", () => {
    if (!currentDestination) return;

    const destName    = encodeURIComponent(currentDestination.name);
    const destPlaceId = encodeURIComponent(currentDestination.placeid);

    // 出発地：originData があればそれを使用、なければ省略
    const origin = originData
      ? `${originData.lat},${originData.lng}`
      : "";

    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destName}&destination_place_id=${destPlaceId}&travelmode=transit`
      : `https://www.google.com/maps/dir/?api=1&destination=${destName}&destination_place_id=${destPlaceId}&travelmode=transit`;

    window.open(url, "_blank");
  });

  /* ── 検索バークリア ── */
  const searchInput    = document.getElementById("searchInput");
  const searchClearBtn = document.getElementById("searchClearBtn");

  function updateClearBtn() {
    searchClearBtn.style.display = searchInput.value.length > 0 ? "block" : "none";
  }
  searchClearBtn.addEventListener("click", clearSearch);
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
      const displayName = (stadium.subname && stadium.subname.trim())
        ? stadium.subname : stadium.name;
      document.getElementById("shopName").innerText = displayName;
      const teamsText = Array.isArray(stadium.teams) && stadium.teams.length
        ? `ホームクラブ: ${stadium.teams.join(" / ")}` : "";
      document.getElementById("shopInfo").innerHTML = teamsText;
      const imgEl = document.getElementById("shopImage");
      imgEl.src = ""; imgEl.style.display = "none";

      document.querySelector(".detail-btn").onclick = () => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stadium.name)}&query_place_id=${stadium.placeid}`, "_blank");
      };

      const r = Number(stadium.radius) || 3;
      const zoom = r <= 1 ? 15 : r <= 2 ? 14 : r <= 3 ? 13 : r <= 5 ? 12 : 11;
      map.setCenter({ lat: Number(stadium.lat), lng: Number(stadium.lng) });
      map.setZoom(zoom);

      currentDestination = {
        placeid: stadium.placeid,
        name: displayName,
        lat: Number(stadium.lat),
        lng: Number(stadium.lng)
      };
      setOriginChk.checked = false;
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

      currentDestination = {
        placeid: shop.placeid,
        name: shop.name,
        lat: Number(shop.lat),
        lng: Number(shop.lng)
      };
      setOriginChk.checked = false;
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

    // ③ 今回ヒットあり かつ 前回もヒットありor初回 のときのみfitBounds
    if (variants.length && stadiumMarkers.length > 0 && hadStadiumResults) {
      fitToMarkers(stadiumMarkers);
    }
    // 初回stadium検索ヒット時もfitBounds
    if (variants.length && stadiumMarkers.length > 0 && !hadStadiumResults) {
      fitToMarkers(stadiumMarkers);
      hadStadiumResults = true;
    }
    // ③ 今回ヒットなし → フラグをリセット（次回ズームしない）
    if (variants.length && stadiumMarkers.length === 0) {
      hadStadiumResults = false;
    }
    // キーワードなし → フラグリセット
    if (!variants.length) {
      hadStadiumResults = false;
    }
  }

  function refreshAllMarkers() {
    refreshShopMarkers();
    refreshStadiumMarkers();
  }

  /* ── タブ：スタジアム ── */
  const stadiumTab = document.getElementById("stadiumTab");
  stadiumTab.addEventListener("click", () => {
    showStadiums = !showStadiums;
    stadiumTab.style.opacity = showStadiums ? "1" : "0.5";
    clearSearch();
    refreshStadiumMarkers();
  });
  stadiumTab.style.opacity = "1";

  /* ── タブ：一般店舗 ── */
  const generalTab = document.getElementById("generalTab");
  generalTab.addEventListener("click", () => {
    showGeneral = !showGeneral;
    generalTab.style.opacity = showGeneral ? "1" : "0.5";
    clearSearch();
    refreshShopMarkers();
  });
  generalTab.style.opacity = "0.5";

  /* ── 検索バー入力 ── */
  searchInput.addEventListener("input", () => {
    updateClearBtn();
    refreshAllMarkers();
  });

  /* ── データ読込（リトライ付き） ── */
  function loadShops(retry = 0) {
    db.collection("shops").get({ source: "server" }).then(snapshot => {
      allShops = [];
      snapshot.forEach(doc => allShops.push(doc.data()));
      refreshShopMarkers();
    }).catch(err => {
      console.warn("shops 読込エラー:", err);
      if (retry < 3) setTimeout(() => loadShops(retry + 1), 2000 * (retry + 1));
    });
  }

  function loadStadiums(retry = 0) {
    db.collection("stadiums").get({ source: "server" }).then(snapshot => {
      allStadiums = [];
      snapshot.forEach(doc => allStadiums.push(doc.data()));
      refreshStadiumMarkers();
    }).catch(err => {
      console.warn("stadiums 読込エラー:", err);
      if (retry < 3) setTimeout(() => loadStadiums(retry + 1), 2000 * (retry + 1));
    });
  }

  /* ── Page Visibility API：タブ復帰時に再読込 ── */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      loadShops();
      loadStadiums();
    }
  });

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
        // ①現在地取得時に出発地を自動セット
        setOrigin({ lat: p.lat, lng: p.lng, name: "現在地" });
      },
      () => {},
      { timeout: 8000 }
    );
  }

  /* ── 初回ロード ── */
  loadShops();
  loadStadiums();
};
