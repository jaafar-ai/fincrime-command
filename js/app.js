const intel=window.INTEL,reuters=window.REUTERS,fixedBriefs=window.FIXED_BRIEFS,links=window.CROSS_BORDER;
const params=new URLSearchParams(location.search);
const startLat=parseFloat(params.get("lat")||22),startLon=parseFloat(params.get("lon")||20),startZoom=parseFloat(params.get("zoom")||1.45);
const initialLayers=(params.get("layers")||"fatf,sanctions,aml,cyber,iqtfs").split(",");
const timeRange=params.get("timeRange")||"7d";
let selectedCountry=params.get("country")||null;
let sourceFilter=null;
let currentPopup=null;

document.getElementById("timeRange").value=timeRange;
document.querySelectorAll(".layer-check").forEach(c=>c.checked=initialLayers.includes(c.value));

const map=new maplibregl.Map({
  container:"map",
  style:"https://demotiles.maplibre.org/style.json",
  center:[startLon,startLat],
  zoom:startZoom,
  attributionControl:true
});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),"top-right");

function activeLayers(){return [...document.querySelectorAll(".layer-check:checked")].map(x=>x.value)}
function filtered(){
  const q=document.getElementById("search").value.toLowerCase().trim(), layersOn=activeLayers();
  return intel.filter(x=>{
    if(!layersOn.includes(x.layer))return false;
    if(sourceFilter && x.body!==sourceFilter && x.source!==sourceFilter)return false;
    if(selectedCountry && x.country!==selectedCountry)return false;
    if(q&&!(`${x.title} ${x.country} ${x.source} ${x.body} ${x.summary}`).toLowerCase().includes(q))return false;
    return true;
  });
}
function geoFiltered(){return {type:"FeatureCollection",features:filtered().map(x=>({type:"Feature",properties:{id:x.id,country:x.country,priority:x.priority},geometry:{type:"Point",coordinates:x.coord}}))}}
function countryNames(){return [...new Set(filtered().map(x=>x.countryKey))]}
function linkGeo(){
  const features=[];
  links.forEach((l,i)=>{
    const coords=[];
    const steps=60;
    for(let s=0;s<=steps;s++){const t=s/steps;coords.push([l.from[0]+(l.to[0]-l.from[0])*t,l.from[1]+(l.to[1]-l.from[1])*t])}
    features.push({type:"Feature",properties:{id:i,label:l.label},geometry:{type:"LineString",coordinates:coords}});
  });
  return {type:"FeatureCollection",features};
}

map.on("load",async()=>{
  try{map.setProjection({type:"globe"})}catch(e){}
  map.setFog({range:[0.5,10],color:"#07090d","high-color":"#111c2c","space-color":"#020306","horizon-blend":0.06});

  map.addSource("countries",{type:"geojson",data:"https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"});
  map.addLayer({id:"country-alert-fill",type:"fill",source:"countries",paint:{
    "fill-color":["case",["in",["get","name"],["literal",countryNames()]],"#ff5664","#000000"],
    "fill-opacity":["case",["in",["get","name"],["literal",countryNames()]],0.16,0]
  }});
  map.addLayer({id:"country-alert-line",type:"line",source:"countries",paint:{
    "line-color":["case",["in",["get","name"],["literal",countryNames()]],"#ff7a84","#000000"],
    "line-width":["case",["in",["get","name"],["literal",countryNames()]],1.2,0],
    "line-opacity":["case",["in",["get","name"],["literal",countryNames()]],0.8,0]
  }});

  map.addSource("intel",{type:"geojson",data:geoFiltered()});
  map.addLayer({id:"halo",type:"circle",source:"intel",paint:{
    "circle-radius":["interpolate",["linear"],["zoom"],0,13,5,26],
    "circle-color":"#ff5664","circle-opacity":0.18,"circle-stroke-color":"#ff5664","circle-stroke-width":1
  }});
  map.addLayer({id:"points",type:"circle",source:"intel",paint:{
    "circle-radius":["interpolate",["linear"],["zoom"],0,4,5,8],
    "circle-color":["match",["get","priority"],"Critical","#ff4453","High","#ff6b75","#ff8790"],
    "circle-stroke-color":"#ffd0d4","circle-stroke-width":1.2
  }});

  map.addSource("links",{type:"geojson",data:linkGeo()});
  map.addLayer({id:"cross-links",type:"line",source:"links",paint:{
    "line-color":"#ff6a74","line-width":1.1,"line-opacity":0.42,"line-dasharray":[2,2]
  }});

  map.on("click","points",e=>focusEvent(Number(e.features[0].properties.id),true));
  map.on("mouseenter","points",()=>map.getCanvas().style.cursor="pointer");
  map.on("mouseleave","points",()=>map.getCanvas().style.cursor="");

  map.on("click","country-alert-fill",e=>{
    if(!e.features?.length)return;
    const name=e.features[0].properties.name;
    const match=intel.find(x=>x.countryKey===name);
    if(match)selectCountry(match.country,false);
  });

  renderAll();
  if(selectedCountry)selectCountry(selectedCountry,false);
});

function updateCountryPaint(){
  if(!map.getLayer("country-alert-fill"))return;
  const names=countryNames();
  map.setPaintProperty("country-alert-fill","fill-color",["case",["in",["get","name"],["literal",names]],"#ff5664","#000000"]);
  map.setPaintProperty("country-alert-fill","fill-opacity",["case",["in",["get","name"],["literal",names]],0.16,0]);
  map.setPaintProperty("country-alert-line","line-color",["case",["in",["get","name"],["literal",names]],"#ff7a84","#000000"]);
  map.setPaintProperty("country-alert-line","line-width",["case",["in",["get","name"],["literal",names]],1.2,0]);
}

function refreshMap(){
  if(map.getSource("intel"))map.getSource("intel").setData(geoFiltered());
  updateCountryPaint();
  renderAll();
  syncUrl();
}

function syncUrl(){
  const c=map.getCenter(),z=map.getZoom(),p=new URLSearchParams();
  p.set("lat",c.lat.toFixed(4));p.set("lon",c.lng.toFixed(4));p.set("zoom",z.toFixed(2));
  p.set("timeRange",document.getElementById("timeRange").value);p.set("layers",activeLayers().join(","));
  if(selectedCountry)p.set("country",selectedCountry);
  history.replaceState(null,"","?"+p.toString());
}
map.on("moveend",syncUrl);

document.getElementById("timeRange").addEventListener("change",syncUrl);
document.querySelectorAll(".layer-check").forEach(c=>c.addEventListener("change",refreshMap));
document.getElementById("allOff").addEventListener("click",()=>{document.querySelectorAll(".layer-check").forEach(c=>c.checked=false);refreshMap()});
document.getElementById("alertOverlay").addEventListener("change",e=>["halo","points"].forEach(id=>map.getLayer(id)&&map.setLayoutProperty(id,"visibility",e.target.checked?"visible":"none")));
document.getElementById("countryFill").addEventListener("change",e=>["country-alert-fill","country-alert-line"].forEach(id=>map.getLayer(id)&&map.setLayoutProperty(id,"visibility",e.target.checked?"visible":"none")));
document.getElementById("showLinks").addEventListener("change",e=>map.getLayer("cross-links")&&map.setLayoutProperty("cross-links","visibility",e.target.checked?"visible":"none"));
document.getElementById("search").addEventListener("input",refreshMap);

document.querySelectorAll("[data-source-filter]").forEach(b=>b.addEventListener("click",()=>{
  const val=b.dataset.sourceFilter;
  sourceFilter=sourceFilter===val?null:val;
  document.querySelectorAll("[data-source-filter]").forEach(x=>x.classList.toggle("active",x.dataset.sourceFilter===sourceFilter));
  refreshMap();
}));

document.getElementById("copyView").addEventListener("click",async()=>{
  syncUrl();
  try{await navigator.clipboard.writeText(location.href)}catch(e){}
  const b=document.getElementById("copyView");b.textContent="Copied";setTimeout(()=>b.textContent="Copy View URL",1200);
});
document.getElementById("resetMap").addEventListener("click",()=>{selectedCountry=null;sourceFilter=null;document.getElementById("countryDrawer").classList.remove("open");map.flyTo({center:[20,22],zoom:1.45,bearing:0,pitch:0,duration:1200});refreshMap()});
document.getElementById("globeMode").addEventListener("click",()=>{try{map.setProjection({type:"globe"})}catch(e){};document.getElementById("globeMode").classList.add("active");document.getElementById("flatMode").classList.remove("active")});
document.getElementById("flatMode").addEventListener("click",()=>{try{map.setProjection({type:"mercator"})}catch(e){};document.getElementById("flatMode").classList.add("active");document.getElementById("globeMode").classList.remove("active")});

function card(x){return `<article class="feed-card" data-id="${x.id}"><span class="tag">${x.layer.toUpperCase()} • ${x.priority}</span><h3>${x.title}</h3><p>${x.summary}</p><div class="feed-meta">${x.country} • ${x.source} • ${x.date}</div></article>`}


const headlineRotation = [
  "IQTFS priority watch: Iraq local sanctions and freezing notices",
  "FATF / FSRB watch: jurisdiction status and evaluation changes",
  "Sanctions watch: OFAC, UN, EU and UK designation changes",
  "AML/CFT watch: regulators, FIUs, banks and enforcement updates",
  "Cyber-financial crime watch: fraud, phishing and cross-border typologies"
];
let headlineIndex=0;
setInterval(()=>{
  headlineIndex=(headlineIndex+1)%headlineRotation.length;
  const el=document.getElementById("tickerText");
  if(el)el.textContent=headlineRotation[headlineIndex];
},5000);

function updateAlertCount(){
  const rows=filtered();
  const count=rows.filter(x=>x.priority==="Critical"||x.priority==="High").length;
  const badge=document.getElementById("alertCount");
  if(badge)badge.textContent=`${count} ALERT${count===1?"":"S"}`;
}

function renderAll(){
  const rows=filtered();
  document.getElementById("visibleCount").textContent=rows.length;
  document.getElementById("feedMode").textContent=selectedCountry||sourceFilter||"Global";
  document.getElementById("feed").innerHTML=rows.map(card).join("")||'<div style="padding:12px;color:#7f8c9e;font-size:10px">No matching intelligence.</div>';
  document.querySelectorAll(".feed-card").forEach(c=>c.addEventListener("click",()=>focusEvent(Number(c.dataset.id),false)));
  renderTimeline();
  updateAlertCount();
}

function selectCountry(country,fly=true){
  selectedCountry=country;
  const rows=intel.filter(x=>x.country===country);
  const first=rows[0];
  if(fly&&first)map.flyTo({center:first.coord,zoom:4,duration:1200});
  document.getElementById("countryTitle").textContent=country;
  document.getElementById("countryStats").innerHTML=`
    <div><b>${rows.length}</b><span>EVENTS</span></div>
    <div><b>${new Set(rows.map(x=>x.layer)).size}</b><span>DOMAINS</span></div>
    <div><b>${new Set(rows.map(x=>x.source)).size}</b><span>SOURCES</span></div>`;
  document.getElementById("countryTags").innerHTML=[...new Set(rows.map(x=>x.body))].map(x=>`<span class="country-tag">${x}</span>`).join("");
  document.getElementById("countrySummary").textContent=`Country intelligence view for ${country}. This profile aggregates AML/CFT, sanctions, FIU, banking, fraud, cybercrime, tax and enforcement intelligence where available.`;
  document.getElementById("countryDrawer").classList.add("open");
  document.getElementById("mapHeadline").textContent=country+" Intelligence";
  document.getElementById("mapSubline").textContent=rows.length+" indexed events";
  refreshMap();
}

document.getElementById("closeCountry").addEventListener("click",()=>{selectedCountry=null;document.getElementById("countryDrawer").classList.remove("open");document.getElementById("mapHeadline").textContent="Global Intelligence Watch";document.getElementById("mapSubline").textContent="Click a country or event";refreshMap()});
document.getElementById("countryAll").addEventListener("click",()=>{selectedCountry=null;document.getElementById("countryDrawer").classList.remove("open");refreshMap()});
document.getElementById("countryTimeline").addEventListener("click",()=>{
  document.querySelector(".timeline-card-static")?.scrollIntoView({behavior:"smooth",block:"center"});
});

function focusEvent(id,fromMap=false){
  const x=intel.find(i=>i.id===id);if(!x)return;
  selectCountry(x.country,false);
  map.flyTo({center:x.coord,zoom:Math.max(4,map.getZoom()),duration:1300});
  if(currentPopup)currentPopup.remove();
  currentPopup=new maplibregl.Popup({offset:12}).setLngLat(x.coord).setHTML(`<b>${x.country}</b><br>${x.title}<br><small>${x.source} • ${x.date}</small>`).addTo(map);
  openModal(x);
}

function openModal(x){
  window.currentItem=x;
  document.getElementById("modalMeta").textContent=`${x.country} • ${x.source} • ${x.date}`;
  document.getElementById("modalTags").innerHTML=[x.layer,x.body,x.priority].map(t=>`<span>${t}</span>`).join("");
  document.getElementById("modalTitle").textContent=x.title;
  document.getElementById("modalEnglish").textContent=x.brief;
  document.getElementById("modalImpact").textContent=x.impact||"Review the original source and assess operational relevance.";
  document.getElementById("modalArabic").textContent=x.ar;
  document.getElementById("arabicBlock").hidden=true;
  document.getElementById("modal").classList.add("open");
}
function openFixed(key){
  const x=fixedBriefs[key];window.currentItem={url:x.url};
  document.getElementById("modalMeta").textContent=x.meta;
  document.getElementById("modalTags").innerHTML=x.tags.map(t=>`<span>${t}</span>`).join("");
  document.getElementById("modalTitle").textContent=x.title;
  document.getElementById("modalEnglish").textContent=x.english;
  document.getElementById("modalImpact").textContent=x.impact;
  document.getElementById("modalArabic").textContent=x.arabic;
  document.getElementById("arabicBlock").hidden=true;
  document.getElementById("modal").classList.add("open");
}
document.querySelectorAll("[data-open-fixed]").forEach(x=>x.addEventListener("click",()=>openFixed(x.dataset.openFixed)));
document.getElementById("close").addEventListener("click",()=>document.getElementById("modal").classList.remove("open"));
document.getElementById("modal").addEventListener("click",e=>{if(e.target.id==="modal")e.currentTarget.classList.remove("open")});
document.getElementById("arabicBtn").addEventListener("click",()=>document.getElementById("arabicBlock").hidden=!document.getElementById("arabicBlock").hidden);
document.getElementById("sourceBtn").addEventListener("click",()=>window.currentItem&&window.open(window.currentItem.url,"_blank"));

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{
  const body=document.getElementById("tab-"+b.dataset.tab);
  if(!body)return;
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".tab-body").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");body.classList.add("active");
}));

function renderTimeline(){
  const q=(document.getElementById("keyword").value||"").toLowerCase(),from=document.getElementById("from").value,to=document.getElementById("to").value,layer=document.getElementById("timelineLayer").value;
  const rows=intel.filter(x=>(!selectedCountry||x.country===selectedCountry)&&(!q||(`${x.title} ${x.country} ${x.source}`).toLowerCase().includes(q))&&(!from||x.date>=from)&&(!to||x.date<=to)&&(!layer||x.layer===layer));
  document.getElementById("timelineResults").innerHTML=rows.map(card).join("");
}
["keyword","from","to","timelineLayer"].forEach(id=>document.getElementById(id).addEventListener("input",renderTimeline));

// Reuters video now uses the official Reuters YouTube uploads playlist embedded directly in the page.


document.getElementById("autoFollow").addEventListener("change",e=>{
  if(!e.target.checked)return;
  const rows=intel.filter(x=>activeLayers().includes(x.layer));
  let i=0;
  const cycle=()=>{if(!document.getElementById("autoFollow").checked)return;const x=rows[i%rows.length];focusEvent(x.id,false);i++;setTimeout(cycle,10000)};
  cycle();
});
