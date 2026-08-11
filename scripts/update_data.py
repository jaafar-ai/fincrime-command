import json,re,requests,feedparser
from pathlib import Path
from datetime import datetime,timezone
from bs4 import BeautifulSoup

P=Path(__file__).resolve().parents[1]/"data/snapshot.json"
d=json.loads(P.read_text(encoding="utf-8"))
H={"User-Agent":"Mozilla/5.0 FINCRIME-COMMAND/1.0"}

def GET(url):
    return requests.get(url,headers=H,timeout=35)

def clean(x):
    return BeautifulSoup(x or "","html.parser").get_text(" ",strip=True)

def trans_ar(text):
    try:
        from deep_translator import GoogleTranslator
        return GoogleTranslator(source="auto",target="ar").translate((text or "")[:3500])
    except Exception:
        return ""

def infer_country(s):
    pairs=[("Lebanon","Lebanon"),("Dubai","United Arab Emirates"),("UAE","United Arab Emirates"),
           ("United States","United States"),(" U.S.","United States"),("US ","United States"),
           ("Swiss","Switzerland"),("Switzerland","Switzerland"),("Brazil","Brazil"),
           ("Palestinian","Palestine"),("Palestine","Palestine"),("Britain","United Kingdom"),
           ("UK ","United Kingdom"),("Iraq","Iraq"),("Iran","Iran"),("France","France")]
    for k,v in pairs:
        if k.lower() in (s or "").lower(): return v
    return "Global"

def rss(query,limit=10):
    url="https://news.google.com/rss/search?q="+requests.utils.quote(query)+"&hl=en-US&gl=US&ceid=US:en"
    f=feedparser.parse(url); out=[]
    for e in f.entries[:limit]:
        summary=clean(getattr(e,"summary",""))
        out.append({"title":e.title,"date":getattr(e,"published",""),"url":e.link,
                    "summary":summary[:650],"country":infer_country(e.title+" "+summary)})
    return out

def update_fx():
    try:
        t=GET("https://www.cbi.iq/").text
        m=re.search(r'USD\s+([0-9,]+(?:\.[0-9]+)?)',t,re.I)
        if m:d["fx"]["official1"]=round(float(m.group(1).replace(",","")))
    except Exception as e: print("CBI",e)
    try:
        t=GET("https://alanchand.com/en/exchange-rates/usd-iqd").text
        m=re.search(r'1 US Dollar equals\s*([0-9,]+)\s*Iraqi Dinar',t,re.I)
        if m:d["fx"]["market100"]=int(m.group(1).replace(",",""))*100
    except Exception as e: print("market",e)

def update_reuters():
    try:
        rows=rss('(AML OR "money laundering" OR sanctions OR "financial crime" OR "terrorist financing") site:reuters.com',10)
        for x in rows: x["ar"]=trans_ar(x["summary"] or x["title"])
        if rows:d["reuters"]=rows
    except Exception as e: print("Reuters",e)
    try:
        rows=rss('(AML OR "money laundering" OR sanctions OR "financial crime") (site:ft.com OR site:apnews.com OR site:bbc.com OR site:acams.org)',10)
        for x in rows:x["source"]="Trusted secondary"
        if rows:d["trusted"]=rows
    except Exception as e: print("trusted",e)

def update_iqtfs():
    try:
        out=[]
        for base,label in [("https://aml.iq/sanctions/local","Local"),("https://aml.iq/sanctions/un","UN")]:
            s=BeautifulSoup(GET(base).text,"html.parser")
            seen=set()
            for a in s.find_all("a",href=True):
                href=a["href"]
                if href.startswith("/"): href="https://aml.iq"+href
                ok=("/sanctions/local/" in href) if label=="Local" else ("/sanctions/un/" in href and "/individual/" in href)
                title=" ".join(a.stripped_strings).strip()
                if ok and title and href not in seen:
                    seen.add(href);out.append({"title":title,"date":datetime.now(timezone.utc).date().isoformat(),
                        "url":href,"summary":("Official Iraqi local sanctions record." if label=="Local" else "UN sanctions record via IQTFS.")})
                    if len(out)>=10: break
            if len(out)>=10: break
        if out:d["iqtfs"]=out[:10]
    except Exception as e: print("IQTFS",e)

def update_fatf():
    # Current official lists are kept as safe fallback. Attempt to locate the latest FATF
    # publications and parse jurisdiction links from their publication-details section.
    try:
        hub=BeautifulSoup(GET("https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html").text,"html.parser")
        links=[]
        for a in hub.find_all("a",href=True):
            h=a["href"]
            if ("increased-monitoring" in h or "call-for-action" in h.lower()) and h not in links:
                links.append(h if h.startswith("http") else "https://www.fatf-gafi.org"+h)
        # The hub lists newest first. Parsing failures leave the verified snapshot untouched.
        for url in links[:4]:
            s=BeautifulSoup(GET(url).text,"html.parser")
            title=s.get_text(" ",strip=True)
            names=[]
            for a in s.find_all("a",href=True):
                if "/en/countries/detail/" in a["href"]:
                    n=" ".join(a.stripped_strings).strip()
                    if n and n not in names:names.append(n)
            if "Increased Monitoring" in title and len(names)>=10:
                flags={x["name"]:x.get("flag","") for x in d["fatf"]["grey_list"]}
                d["fatf"]["grey_list"]=[{"name":n,"flag":flags.get(n,"")} for n in names[-30:]]
                break
        d["fatf"]["checked_at"]=datetime.now(timezone.utc).isoformat()
    except Exception as e: print("FATF",e)

update_fx();update_reuters();update_iqtfs();update_fatf()
d["updated_at"]=datetime.now(timezone.utc).isoformat()
P.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding="utf-8")
print("updated")
