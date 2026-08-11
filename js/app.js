const intel=window.INTEL,reuters=window.REUTERS;
const params=new URLSearchParams(location.search);
const startLat=parseFloat(params.get("lat")||22),startLon=parseFloat(params.get("lon")||20),startZoom=parseFloat(params.get("zoom")||1.45);
const initialLayers=(params.get("layers")||"fatf,sanctions,aml,cyber").split(",");
const timeRange=params.get("timeRange")||"7d";
document.getElementById("timeRange").value=timeRange;
document.querySelectorAll(".layer-check").forEach(c=>c.checked=initialLayers.includes(c.value));

const map=new maplibregl.Map({container:"map",style:"https://demotiles.maplibre.org/style.json",center:[startLon,startLat],zoom:startZoom});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),"top-right");
map.on("load",()=>{
 try{map.setProjection({type:"globe"})}catch(e){}
 map.setFog({range:[0.5,10],color:"#07090d","high-color":"#111c2c","space-color":"#020306","horizon-blend":0.06});
 map.addSource("intel",{type:"geojson",data:geoFiltered()});
 map.addLayer({id:"halo",type:"circle",source:"intel",paint:{"circle-radius":["interpolate",["linear"],["zoom"],0,13,5,26],"circle-color":"#ff5664","circle-opacity":0.18,"circle-stroke-color":"#ff5664","circle-stroke-width":1}});
 map.addLayer({id:"points",type:"circle",source:"intel",paint:{"circle-radius":["interpolate",["linear"],["zoom"],0,4,5,8],"circle-color":"#ff5664","circle-stroke-color":"#ffb0b5","circle-stroke-width":1.2}});
 map.on("click","points",e=>focusEvent(Number(e.features[0].properties.id),true));
 renderAll();
});
function activeLayers(){return [...document.querySelectorAll(".layer-check:checked")].map(x=>x.value)}
function filtered(){
 const q=document.getElementById("search").value.toLowerCase().trim(), layers=activeLayers();
 return intel.filter(x=>layers.includes(x.layer)&&(!q||(`${x.title} ${x.country} ${x.source} ${x.summary}`).toLowerCase().includes(q)));
}
function geoFiltered(){return {type:"FeatureCollection",features:filtered().map(x=>({type:"Feature",properties:{id:x.id},geometry:{type:"Point",coordinates:x.coord}}))}}
function refreshMap(){if(map.getSource("intel"))map.getSource("intel").setData(geoFiltered());renderAll();syncUrl()}
function syncUrl(){
 const c=map.getCenter(),z=map.getZoom();
 const p=new URLSearchParams();
 p.set("lat",c.lat.toFixed(4));p.set("lon",c.lng.toFixed(4));p.set("zoom",z.toFixed(2));p.set("timeRange",document.getElementById("timeRange").value);p.set("layers",activeLayers().join(","));
 history.replaceState(null,"","?"+p.toString());
}
map.on("moveend",syncUrl);
document.getElementById("timeRange").addEventListener("change",syncUrl);
document.querySelectorAll(".layer-check").forEach(c=>c.addEventListener("change",refreshMap));
document.getElementById("allOff").addEventListener("click",()=>{document.querySelectorAll(".layer-check").forEach(c=>c.checked=false);refreshMap()});
document.getElementById("alertOverlay").addEventListener("change",e=>["halo","points"].forEach(id=>map.getLayer(id)&&map.setLayoutProperty(id,"visibility",e.target.checked?"visible":"none")));
document.getElementById("search").addEventListener("input",refreshMap);
document.getElementById("copyView").addEventListener("click",()=>{syncUrl();navigator.clipboard?.writeText(location.href);document.getElementById("copyView").textContent="Copied";setTimeout(()=>document.getElementById("copyView").textContent="Copy View URL",1200)});

function card(x){return `<article class="feed-card" data-id="${x.id}"><span class="tag">${x.layer.toUpperCase()}</span><h3>${x.title}</h3><p>${x.summary}</p><div class="feed-meta">${x.country} • ${x.source} • ${x.date}</div></article>`}
function renderAll(){
 const rows=filtered();document.getElementById("visibleCount").textContent=rows.length;document.getElementById("feed").innerHTML=rows.map(card).join("");
 document.querySelectorAll(".feed-card").forEach(c=>c.addEventListener("click",()=>focusEvent(Number(c.dataset.id),false)));
 renderTimeline();
}
function focusEvent(id,fromMap=false){
 const x=intel.find(i=>i.id===id);if(!x)return;
 map.flyTo({center:x.coord,zoom:Math.max(4,map.getZoom()),duration:1300});
 openModal(x);
}
function openModal(x){window.currentItem=x;document.getElementById("modalMeta").textContent=`${x.country} • ${x.source} • ${x.date}`;document.getElementById("modalTitle").textContent=x.title;document.getElementById("modalEnglish").textContent=x.brief;document.getElementById("modalArabic").textContent=x.ar;document.getElementById("arabicBlock").hidden=true;document.getElementById("modal").classList.add("open")}
document.getElementById("close").addEventListener("click",()=>document.getElementById("modal").classList.remove("open"));document.getElementById("modal").addEventListener("click",e=>{if(e.target.id==="modal")e.currentTarget.classList.remove("open")});
document.getElementById("arabicBtn").addEventListener("click",()=>document.getElementById("arabicBlock").hidden=!document.getElementById("arabicBlock").hidden);
document.getElementById("sourceBtn").addEventListener("click",()=>window.currentItem&&window.open(window.currentItem.url,"_blank"));

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".tab-body").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById("tab-"+b.dataset.tab).classList.add("active")}));

function renderTimeline(){
 const q=(document.getElementById("keyword").value||"").toLowerCase(),from=document.getElementById("from").value,to=document.getElementById("to").value;
 const rows=filtered().filter(x=>(!q||(`${x.title} ${x.country} ${x.source}`).toLowerCase().includes(q))&&(!from||x.date>=from)&&(!to||x.date<=to));
 document.getElementById("timelineResults").innerHTML=rows.map(card).join("");
}
["keyword","from","to"].forEach(id=>document.getElementById(id).addEventListener("input",renderTimeline));

let ri=0,auto=true,elapsed=0;
function renderReuters(){const x=reuters[ri];document.getElementById("videoTitle").textContent=x.title;document.getElementById("videoMeta").textContent=`Reuters • ${x.topic}`;document.getElementById("progress").style.width="0%";elapsed=0;document.getElementById("queue").innerHTML=reuters.map((v,i)=>`<div class="queue-item ${i===ri?"active":""}" data-r="${i}">${i+1}. ${v.title}<br><small>${v.topic}</small></div>`).join("");document.querySelectorAll("[data-r]").forEach(x=>x.addEventListener("click",()=>{ri=Number(x.dataset.r);renderReuters()}))}
document.getElementById("next").addEventListener("click",()=>{ri=(ri+1)%reuters.length;renderReuters()});document.getElementById("prev").addEventListener("click",()=>{ri=(ri-1+reuters.length)%reuters.length;renderReuters()});document.getElementById("pause").addEventListener("click",e=>{auto=!auto;e.currentTarget.textContent=auto?"Pause Auto":"Resume Auto"});
setInterval(()=>{if(!auto)return;elapsed++;document.getElementById("progress").style.width=(elapsed/18*100)+"%";if(elapsed>=18){ri=(ri+1)%reuters.length;renderReuters()}},1000);renderReuters();

document.getElementById("autoFollow").addEventListener("change",e=>{if(e.target.checked){const x=filtered()[0];if(x)focusEvent(x.id,false)}});