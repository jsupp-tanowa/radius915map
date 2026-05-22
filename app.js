/* Firebase */

const firebaseConfig = {
  apiKey:"AIzaSyCyzwwPiCcUCICxv6kcx7ZlaNkMa46hcVA",
  authDomain:"japan-football-supporters-hub.firebaseapp.com",
  projectId:"japan-football-supporters-hub",
  storageBucket:"japan-football-supporters-hub.firebasestorage.app",
  messagingSenderId:"607581916231",
  appId:"1:607581916231:web:d857fe57f315dea46db562"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

let map;
let userLocation=null;
let currentMarker=null;


/* 現在地 */

function moveToCurrentLocation(){

  if(!navigator.geolocation){
    alert("位置情報が使えません");
    return;
  }

  navigator.geolocation.getCurrentPosition(

    function(position){

      const currentPos={
        lat:position.coords.latitude,
        lng:position.coords.longitude
      };

      userLocation=currentPos;

      map.setCenter(currentPos);
      map.setZoom(14);

      if(currentMarker){
        currentMarker.setMap(null);
      }

      currentMarker=new google.maps.Marker({
        position:currentPos,
        map:map,
        title:"現在地",
        icon:"https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
      });

      loadShops();

    },

    function(){
      alert("位置情報の取得に失敗しました");
    }

  );

}


/* 距離計算 */

function getDistance(lat1,lng1,lat2,lng2){

  const R=6371;

  const dLat=(lat2-lat1)*Math.PI/180;
  const dLng=(lng2-lng1)*Math.PI/180;

  const a=
    Math.sin(dLat/2)**2+
    Math.cos(lat1*Math.PI/180)*
    Math.cos(lat2*Math.PI/180)*
    Math.sin(dLng/2)**2;

  const c=
    2*Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1-a)
    );

  return R*c;

}


/* 店舗読込 */

function loadShops(){

  db.collection("shops")
  .get()
  .then(snapshot=>{

    const bounds=
      new google.maps.LatLngBounds();

    snapshot.forEach(doc=>{

      const shop=doc.data();

      let distanceText="";

      if(userLocation){

        const distance=
        getDistance(
          userLocation.lat,
          userLocation.lng,
          Number(shop.lat),
          Number(shop.lng)
        );

        distanceText=
        "距離: "+
        distance.toFixed(2)+
        " km<br>";

      }


      const iconColor=
      shop.away
      ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
      : "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";


      const marker=
      new google.maps.Marker({

        position:{
          lat:Number(shop.lat),
          lng:Number(shop.lng)
        },

        map:map,
        title:shop.name,
        icon:iconColor

      });


      bounds.extend(
        marker.getPosition()
      );


      const googleMapLink=
      "https://www.google.com/maps?q="+
      shop.lat+
      ","+
      shop.lng;


      const infoWindow=
      new google.maps.InfoWindow({

        content:

        "<div style='font-size:16px;line-height:1.8'>" +

        "<strong style='font-size:20px'>" +
        shop.name +
        "</strong><br>" +

        "応援クラブ: " +
        shop.team +
        "<br>" +

        distanceText +

        "ジャンル: " +
        shop.genre +
        "<br>" +

        "アウェイサポーター: " +
        (shop.away ? "歓迎！":"厳しい・・・") +
        "<br>" +

        (shop.note || "") +

        "<br><br>" +

        "<a style='font-size:18px' href='" +
        googleMapLink +
        "' target='_blank'>" +

        "Googleマップで開く</a>" +

        "</div>"

      });


marker.addListener(
"click",
()=>{

document.getElementById(
"shopCard"
).style.display="block";

document.getElementById(
"shopName"
).innerText=
shop.name;

document.getElementById(
"shopInfo"
).innerHTML=

"応援: "+shop.team+
"<br>"+
"ジャンル: "+(shop.genre||"")+
"<br>"+
(shop.note||"");

document.getElementById(
"shopImage"
).src=

shop.image ||
"https://picsum.photos/600/300";

}
);
    });


    if(!snapshot.empty){

      map.fitBounds(bounds);

      google.maps.event.addListenerOnce(
        map,
        "bounds_changed",
        ()=>{

          if(map.getZoom()>14){
            map.setZoom(14);
          }

        }
      );

    }

  });

}


/* 地図初期化 */

window.initMap = function(){

  map = new google.maps.Map(
    document.getElementById("map"),
    {
      center:{
        lat:34.7284,
        lng:135.4814
      },
      zoom:16
    }
  );

  loadShops();

  const card =
  document.getElementById("shopCard");

  if(!card) return;

  let startY=0;

  card.addEventListener(
    "touchstart",
    e=>{
      startY=e.touches[0].clientY;
    }
  );

  card.addEventListener(
    "touchmove",
    e=>{

      e.preventDefault();

      const moveY=
      e.touches[0].clientY;

      const diff=
      startY-moveY;

      if(diff>50){
        card.classList.add("open");
      }

      if(diff<-50){
        card.classList.remove("open");
      }

    }
  );

};
