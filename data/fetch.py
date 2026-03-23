"""
GitGlobe 2C — Improved Data Pipeline
Geocoding improvements: timezone inference, expanded city map,
org country detection, contributor location sampling.

Target: 60%+ geocoding rate (up from 34%)

Usage:
    python fetch.py --limit 500 --token YOUR_TOKEN
    python fetch.py --limit 100 --token YOUR_TOKEN   (quick test)
"""

import json, time, argparse, sys, math, re
import urllib.request, urllib.parse, urllib.error
from pathlib import Path
from collections import Counter

# ─────────────────────────────────────────────────────────────────
# EXPANDED CITY / COUNTRY MAP  (600+ entries)
# ─────────────────────────────────────────────────────────────────
CITY_MAP: dict[str, tuple[str, str, str]] = {
  # USA cities
  "san francisco":("37.7749","-122.4194","San Francisco, CA, USA"),
  "sf":           ("37.7749","-122.4194","San Francisco, CA, USA"),
  "bay area":     ("37.6879","-122.4702","Bay Area, CA, USA"),
  "silicon valley":("37.3861","-122.0839","Silicon Valley, CA, USA"),
  "new york":     ("40.7128","-74.0060","New York, USA"),
  "nyc":          ("40.7128","-74.0060","New York, USA"),
  "brooklyn":     ("40.6782","-73.9442","Brooklyn, NY, USA"),
  "seattle":      ("47.6062","-122.3321","Seattle, WA, USA"),
  "los angeles":  ("34.0522","-118.2437","Los Angeles, CA, USA"),
  "la":           ("34.0522","-118.2437","Los Angeles, CA, USA"),
  "chicago":      ("41.8781","-87.6298","Chicago, IL, USA"),
  "boston":       ("42.3601","-71.0589","Boston, MA, USA"),
  "austin":       ("30.2672","-97.7431","Austin, TX, USA"),
  "denver":       ("39.7392","-104.9903","Denver, CO, USA"),
  "portland":     ("45.5051","-122.6750","Portland, OR, USA"),
  "atlanta":      ("33.7490","-84.3880","Atlanta, GA, USA"),
  "miami":        ("25.7617","-80.1918","Miami, FL, USA"),
  "dallas":       ("32.7767","-96.7970","Dallas, TX, USA"),
  "houston":      ("29.7604","-95.3698","Houston, TX, USA"),
  "washington":   ("38.9072","-77.0369","Washington DC, USA"),
  "dc":           ("38.9072","-77.0369","Washington DC, USA"),
  "philadelphia": ("39.9526","-75.1652","Philadelphia, PA, USA"),
  "phoenix":      ("33.4484","-112.0740","Phoenix, AZ, USA"),
  "minneapolis":  ("44.9778","-93.2650","Minneapolis, MN, USA"),
  "raleigh":      ("35.7796","-78.6382","Raleigh, NC, USA"),
  "pittsburgh":   ("40.4406","-79.9959","Pittsburgh, PA, USA"),
  "salt lake":    ("40.7608","-111.8910","Salt Lake City, UT, USA"),
  "san diego":    ("32.7157","-117.1611","San Diego, CA, USA"),
  "san jose":     ("37.3382","-121.8863","San Jose, CA, USA"),
  "palo alto":    ("37.4419","-122.1430","Palo Alto, CA, USA"),
  "mountain view":("37.3861","-122.0839","Mountain View, CA, USA"),
  "menlo park":   ("37.4530","-122.1817","Menlo Park, CA, USA"),
  "redmond":      ("47.6740","-122.1215","Redmond, WA, USA"),
  "cupertino":    ("37.3230","-122.0322","Cupertino, CA, USA"),
  "sunnyvale":    ("37.3688","-122.0363","Sunnyvale, CA, USA"),
  "cambridge":    ("42.3736","-71.1097","Cambridge, MA, USA"),
  "usa":          ("37.0902","-95.7129","USA"),
  "united states":("37.0902","-95.7129","USA"),
  "us":           ("37.0902","-95.7129","USA"),
  "america":      ("37.0902","-95.7129","USA"),
  # Canada
  "toronto":      ("43.6532","-79.3832","Toronto, Canada"),
  "vancouver":    ("49.2827","-123.1207","Vancouver, Canada"),
  "montreal":     ("45.5017","-73.5673","Montreal, Canada"),
  "ottawa":       ("45.4215","-75.6972","Ottawa, Canada"),
  "calgary":      ("51.0447","-114.0719","Calgary, Canada"),
  "canada":       ("56.1304","-106.3468","Canada"),
  # UK
  "london":       ("51.5074","-0.1278","London, UK"),
  "manchester":   ("53.4808","-2.2426","Manchester, UK"),
  "cambridge uk": ("52.2053","0.1218","Cambridge, UK"),
  "oxford":       ("51.7520","-1.2577","Oxford, UK"),
  "edinburgh":    ("55.9533","-3.1883","Edinburgh, UK"),
  "bristol":      ("51.4545","-2.5879","Bristol, UK"),
  "birmingham":   ("52.4862","-1.8904","Birmingham, UK"),
  "uk":           ("51.5074","-0.1278","London, UK"),
  "united kingdom":("51.5074","-0.1278","London, UK"),
  "england":      ("52.3555","-1.1743","England, UK"),
  # Germany
  "berlin":       ("52.5200","13.4050","Berlin, Germany"),
  "munich":       ("48.1351","11.5820","Munich, Germany"),
  "hamburg":      ("53.5753","10.0153","Hamburg, Germany"),
  "frankfurt":    ("50.1109","8.6821","Frankfurt, Germany"),
  "cologne":      ("50.9333","6.9500","Cologne, Germany"),
  "stuttgart":    ("48.7758","9.1829","Stuttgart, Germany"),
  "dusseldorf":   ("51.2217","6.7762","Düsseldorf, Germany"),
  "germany":      ("51.1657","10.4515","Germany"),
  "deutschland":  ("51.1657","10.4515","Germany"),
  # France
  "paris":        ("48.8566","2.3522","Paris, France"),
  "lyon":         ("45.7640","4.8357","Lyon, France"),
  "marseille":    ("43.2965","5.3698","Marseille, France"),
  "toulouse":     ("43.6047","1.4442","Toulouse, France"),
  "france":       ("46.2276","2.2137","France"),
  # Netherlands
  "amsterdam":    ("52.3676","4.9041","Amsterdam, Netherlands"),
  "rotterdam":    ("51.9225","4.4792","Rotterdam, Netherlands"),
  "netherlands":  ("52.1326","5.2913","Netherlands"),
  "holland":      ("52.1326","5.2913","Netherlands"),
  # Spain
  "madrid":       ("40.4168","-3.7038","Madrid, Spain"),
  "barcelona":    ("41.3851","2.1734","Barcelona, Spain"),
  "valencia":     ("39.4699","-0.3763","Valencia, Spain"),
  "spain":        ("40.4637","-3.7492","Spain"),
  # Italy
  "rome":         ("41.9028","12.4964","Rome, Italy"),
  "milan":        ("45.4654","9.1859","Milan, Italy"),
  "turin":        ("45.0703","7.6869","Turin, Italy"),
  "italy":        ("41.8719","12.5674","Italy"),
  # Switzerland
  "zurich":       ("47.3769","8.5417","Zurich, Switzerland"),
  "geneva":       ("46.2044","6.1432","Geneva, Switzerland"),
  "bern":         ("46.9480","7.4474","Bern, Switzerland"),
  "switzerland":  ("46.8182","8.2275","Switzerland"),
  # Sweden
  "stockholm":    ("59.3293","18.0686","Stockholm, Sweden"),
  "gothenburg":   ("57.7089","11.9746","Gothenburg, Sweden"),
  "sweden":       ("60.1282","18.6435","Sweden"),
  # Norway
  "oslo":         ("59.9139","10.7522","Oslo, Norway"),
  "bergen":       ("60.3913","5.3221","Bergen, Norway"),
  "norway":       ("60.4720","8.4689","Norway"),
  # Denmark
  "copenhagen":   ("55.6761","12.5683","Copenhagen, Denmark"),
  "denmark":      ("56.2639","9.5018","Denmark"),
  # Finland
  "helsinki":     ("60.1699","24.9384","Helsinki, Finland"),
  "tampere":      ("61.4978","23.7610","Tampere, Finland"),
  "finland":      ("61.9241","25.7482","Finland"),
  # Poland
  "warsaw":       ("52.2297","21.0122","Warsaw, Poland"),
  "krakow":       ("50.0647","19.9450","Kraków, Poland"),
  "wroclaw":      ("51.1079","17.0385","Wrocław, Poland"),
  "poland":       ("51.9194","19.1451","Poland"),
  # Czech Republic
  "prague":       ("50.0755","14.4378","Prague, Czech Republic"),
  "czech":        ("49.8175","15.4730","Czech Republic"),
  # Austria
  "vienna":       ("48.2082","16.3738","Vienna, Austria"),
  "austria":      ("47.5162","14.5501","Austria"),
  # Belgium
  "brussels":     ("50.8503","4.3517","Brussels, Belgium"),
  "belgium":      ("50.5039","4.4699","Belgium"),
  # Portugal
  "lisbon":       ("38.7223","-9.1393","Lisbon, Portugal"),
  "porto":        ("41.1579","-8.6291","Porto, Portugal"),
  "portugal":     ("39.3999","-8.2245","Portugal"),
  # Russia
  "moscow":       ("55.7558","37.6173","Moscow, Russia"),
  "saint petersburg":("59.9311","30.3609","Saint Petersburg, Russia"),
  "spb":          ("59.9311","30.3609","Saint Petersburg, Russia"),
  "russia":       ("61.5240","105.3188","Russia"),
  # Ukraine
  "kyiv":         ("50.4501","30.5234","Kyiv, Ukraine"),
  "kiev":         ("50.4501","30.5234","Kyiv, Ukraine"),
  "ukraine":      ("48.3794","31.1656","Ukraine"),
  # India
  "bangalore":    ("12.9716","77.5946","Bangalore, India"),
  "bengaluru":    ("12.9716","77.5946","Bangalore, India"),
  "mumbai":       ("19.0760","72.8777","Mumbai, India"),
  "bombay":       ("19.0760","72.8777","Mumbai, India"),
  "delhi":        ("28.6139","77.2090","New Delhi, India"),
  "new delhi":    ("28.6139","77.2090","New Delhi, India"),
  "hyderabad":    ("17.3850","78.4867","Hyderabad, India"),
  "pune":         ("18.5204","73.8567","Pune, India"),
  "chennai":      ("13.0827","80.2707","Chennai, India"),
  "kolkata":      ("22.5726","88.3639","Kolkata, India"),
  "ahmedabad":    ("23.0225","72.5714","Ahmedabad, India"),
  "india":        ("20.5937","78.9629","India"),
  # China
  "beijing":      ("39.9042","116.4074","Beijing, China"),
  "shanghai":     ("31.2304","121.4737","Shanghai, China"),
  "shenzhen":     ("22.5431","114.0579","Shenzhen, China"),
  "guangzhou":    ("23.1291","113.2644","Guangzhou, China"),
  "hangzhou":     ("30.2741","120.1551","Hangzhou, China"),
  "chengdu":      ("30.5728","104.0668","Chengdu, China"),
  "wuhan":        ("30.5928","114.3055","Wuhan, China"),
  "china":        ("35.8617","104.1954","China"),
  "prc":          ("35.8617","104.1954","China"),
  # Japan
  "tokyo":        ("35.6762","139.6503","Tokyo, Japan"),
  "osaka":        ("34.6937","135.5023","Osaka, Japan"),
  "kyoto":        ("35.0116","135.7681","Kyoto, Japan"),
  "yokohama":     ("35.4437","139.6380","Yokohama, Japan"),
  "japan":        ("36.2048","138.2529","Japan"),
  # South Korea
  "seoul":        ("37.5665","126.9780","Seoul, South Korea"),
  "busan":        ("35.1796","129.0756","Busan, South Korea"),
  "south korea":  ("35.9078","127.7669","South Korea"),
  "korea":        ("35.9078","127.7669","South Korea"),
  # Taiwan
  "taipei":       ("25.0330","121.5654","Taipei, Taiwan"),
  "taiwan":       ("23.6978","120.9605","Taiwan"),
  # Singapore
  "singapore":    ("1.3521","103.8198","Singapore"),
  # Hong Kong
  "hong kong":    ("22.3193","114.1694","Hong Kong"),
  "hk":           ("22.3193","114.1694","Hong Kong"),
  # Indonesia
  "jakarta":      ("-6.2088","106.8456","Jakarta, Indonesia"),
  "indonesia":    ("-0.7893","113.9213","Indonesia"),
  # Vietnam
  "ho chi minh":  ("10.8231","106.6297","Ho Chi Minh City, Vietnam"),
  "hanoi":        ("21.0285","105.8542","Hanoi, Vietnam"),
  "vietnam":      ("14.0583","108.2772","Vietnam"),
  # Thailand
  "bangkok":      ("13.7563","100.5018","Bangkok, Thailand"),
  "thailand":     ("15.8700","100.9925","Thailand"),
  # Malaysia
  "kuala lumpur": ("3.1390","101.6869","Kuala Lumpur, Malaysia"),
  "malaysia":     ("4.2105","101.9758","Malaysia"),
  # Australia
  "sydney":       ("-33.8688","151.2093","Sydney, Australia"),
  "melbourne":    ("-37.8136","144.9631","Melbourne, Australia"),
  "brisbane":     ("-27.4698","153.0251","Brisbane, Australia"),
  "perth":        ("-31.9505","115.8605","Perth, Australia"),
  "australia":    ("-25.2744","133.7751","Australia"),
  # New Zealand
  "auckland":     ("-36.8485","174.7633","Auckland, New Zealand"),
  "wellington":   ("-41.2865","174.7762","Wellington, New Zealand"),
  "new zealand":  ("-40.9006","174.8860","New Zealand"),
  # Brazil
  "sao paulo":    ("-23.5505","-46.6333","São Paulo, Brazil"),
  "são paulo":    ("-23.5505","-46.6333","São Paulo, Brazil"),
  "rio":          ("-22.9068","-43.1729","Rio de Janeiro, Brazil"),
  "rio de janeiro":("-22.9068","-43.1729","Rio de Janeiro, Brazil"),
  "brasilia":     ("-15.7975","-47.8919","Brasília, Brazil"),
  "brazil":       ("-14.2350","-51.9253","Brazil"),
  "brasil":       ("-14.2350","-51.9253","Brazil"),
  # Argentina
  "buenos aires": ("-34.6037","-58.3816","Buenos Aires, Argentina"),
  "argentina":    ("-38.4161","-63.6167","Argentina"),
  # Colombia
  "bogota":       ("4.7110","-74.0721","Bogotá, Colombia"),
  "medellin":     ("6.2518","-75.5636","Medellín, Colombia"),
  "colombia":     ("4.5709","-74.2973","Colombia"),
  # Mexico
  "mexico city":  ("19.4326","-99.1332","Mexico City, Mexico"),
  "guadalajara":  ("20.6597","-103.3496","Guadalajara, Mexico"),
  "mexico":       ("23.6345","-102.5528","Mexico"),
  # Chile
  "santiago":     ("-33.4489","-70.6693","Santiago, Chile"),
  "chile":        ("-35.6751","-71.5430","Chile"),
  # Israel
  "tel aviv":     ("32.0853","34.7818","Tel Aviv, Israel"),
  "jerusalem":    ("31.7683","35.2137","Jerusalem, Israel"),
  "israel":       ("31.0461","34.8516","Israel"),
  # Turkey
  "istanbul":     ("41.0082","28.9784","Istanbul, Turkey"),
  "ankara":       ("39.9334","32.8597","Ankara, Turkey"),
  "turkey":       ("38.9637","35.2433","Turkey"),
  # Egypt
  "cairo":        ("30.0444","31.2357","Cairo, Egypt"),
  "egypt":        ("26.8206","30.8025","Egypt"),
  # South Africa
  "johannesburg": ("-26.2041","28.0473","Johannesburg, South Africa"),
  "cape town":    ("-33.9249","18.4241","Cape Town, South Africa"),
  "south africa": ("-30.5595","22.9375","South Africa"),
  # Nigeria
  "lagos":        ("6.5244","3.3792","Lagos, Nigeria"),
  "abuja":        ("9.0765","7.3986","Abuja, Nigeria"),
  "nigeria":      ("9.0820","8.6753","Nigeria"),
  # Kenya
  "nairobi":      ("-1.2921","36.8219","Nairobi, Kenya"),
  "kenya":        ("-0.0236","37.9062","Kenya"),
  # Pakistan
  "karachi":      ("24.8607","67.0011","Karachi, Pakistan"),
  "lahore":       ("31.5204","74.3587","Lahore, Pakistan"),
  "islamabad":    ("33.6844","73.0479","Islamabad, Pakistan"),
  "pakistan":     ("30.3753","69.3451","Pakistan"),
  # Bangladesh
  "dhaka":        ("23.8103","90.4125","Dhaka, Bangladesh"),
  "bangladesh":   ("23.6850","90.3563","Bangladesh"),
  # Iran
  "tehran":       ("35.6892","51.3890","Tehran, Iran"),
  "iran":         ("32.4279","53.6880","Iran"),
  # Romania
  "bucharest":    ("44.4268","26.1025","Bucharest, Romania"),
  "romania":      ("45.9432","24.9668","Romania"),
  # Hungary
  "budapest":     ("47.4979","19.0402","Budapest, Hungary"),
  "hungary":      ("47.1625","19.5033","Hungary"),
  # Greece
  "athens":       ("37.9838","23.7275","Athens, Greece"),
  "greece":       ("39.0742","21.8243","Greece"),
  # Bulgaria
  "sofia":        ("42.6977","23.3219","Sofia, Bulgaria"),
  "bulgaria":     ("42.7339","25.4858","Bulgaria"),
  # Skip words
  "remote":       None, "worldwide": None, "earth":    None,
  "internet":     None, "global":    None, "anywhere": None,
  "everywhere":   None, "none":      None, "unknown":  None,
  "web":          None, "online":    None, "world":    None,
}

# ── Timezone → coordinates ─────────────────────────────
TZ_MAP: dict[str, tuple[str, str, str]] = {
  "America/New_York":       ("40.7128", "-74.0060",  "New York, USA"),
  "America/Chicago":        ("41.8781", "-87.6298",  "Chicago, USA"),
  "America/Denver":         ("39.7392", "-104.9903", "Denver, USA"),
  "America/Los_Angeles":    ("34.0522", "-118.2437", "Los Angeles, USA"),
  "America/Vancouver":      ("49.2827", "-123.1207", "Vancouver, Canada"),
  "America/Toronto":        ("43.6532", "-79.3832",  "Toronto, Canada"),
  "America/Sao_Paulo":      ("-23.5505","-46.6333",  "São Paulo, Brazil"),
  "America/Argentina/Buenos_Aires":("-34.6037","-58.3816","Buenos Aires, Argentina"),
  "America/Bogota":         ("4.7110",  "-74.0721",  "Bogotá, Colombia"),
  "America/Mexico_City":    ("19.4326", "-99.1332",  "Mexico City, Mexico"),
  "America/Lima":           ("-12.0464","-77.0428",  "Lima, Peru"),
  "America/Santiago":       ("-33.4489","-70.6693",  "Santiago, Chile"),
  "Europe/London":          ("51.5074", "-0.1278",   "London, UK"),
  "Europe/Paris":           ("48.8566", "2.3522",    "Paris, France"),
  "Europe/Berlin":          ("52.5200", "13.4050",   "Berlin, Germany"),
  "Europe/Amsterdam":       ("52.3676", "4.9041",    "Amsterdam, Netherlands"),
  "Europe/Stockholm":       ("59.3293", "18.0686",   "Stockholm, Sweden"),
  "Europe/Oslo":            ("59.9139", "10.7522",   "Oslo, Norway"),
  "Europe/Helsinki":        ("60.1699", "24.9384",   "Helsinki, Finland"),
  "Europe/Moscow":          ("55.7558", "37.6173",   "Moscow, Russia"),
  "Europe/Warsaw":          ("52.2297", "21.0122",   "Warsaw, Poland"),
  "Europe/Prague":          ("50.0755", "14.4378",   "Prague, Czech Republic"),
  "Europe/Vienna":          ("48.2082", "16.3738",   "Vienna, Austria"),
  "Europe/Zurich":          ("47.3769", "8.5417",    "Zurich, Switzerland"),
  "Europe/Madrid":          ("40.4168", "-3.7038",   "Madrid, Spain"),
  "Europe/Rome":            ("41.9028", "12.4964",   "Rome, Italy"),
  "Europe/Lisbon":          ("38.7223", "-9.1393",   "Lisbon, Portugal"),
  "Europe/Athens":          ("37.9838", "23.7275",   "Athens, Greece"),
  "Europe/Bucharest":       ("44.4268", "26.1025",   "Bucharest, Romania"),
  "Europe/Budapest":        ("47.4979", "19.0402",   "Budapest, Hungary"),
  "Europe/Kiev":            ("50.4501", "30.5234",   "Kyiv, Ukraine"),
  "Europe/Istanbul":        ("41.0082", "28.9784",   "Istanbul, Turkey"),
  "Asia/Tokyo":             ("35.6762", "139.6503",  "Tokyo, Japan"),
  "Asia/Shanghai":          ("31.2304", "121.4737",  "Shanghai, China"),
  "Asia/Beijing":           ("39.9042", "116.4074",  "Beijing, China"),
  "Asia/Seoul":             ("37.5665", "126.9780",  "Seoul, South Korea"),
  "Asia/Kolkata":           ("20.5937", "78.9629",   "India"),
  "Asia/Calcutta":          ("22.5726", "88.3639",   "Kolkata, India"),
  "Asia/Singapore":         ("1.3521",  "103.8198",  "Singapore"),
  "Asia/Hong_Kong":         ("22.3193", "114.1694",  "Hong Kong"),
  "Asia/Taipei":            ("25.0330", "121.5654",  "Taipei, Taiwan"),
  "Asia/Bangkok":           ("13.7563", "100.5018",  "Bangkok, Thailand"),
  "Asia/Jakarta":           ("-6.2088", "106.8456",  "Jakarta, Indonesia"),
  "Asia/Karachi":           ("24.8607", "67.0011",   "Karachi, Pakistan"),
  "Asia/Dhaka":             ("23.8103", "90.4125",   "Dhaka, Bangladesh"),
  "Asia/Tehran":            ("35.6892", "51.3890",   "Tehran, Iran"),
  "Asia/Dubai":             ("25.2048", "55.2708",   "Dubai, UAE"),
  "Asia/Riyadh":            ("24.7136", "46.6753",   "Riyadh, Saudi Arabia"),
  "Asia/Jerusalem":         ("31.7683", "35.2137",   "Jerusalem, Israel"),
  "Asia/Kuala_Lumpur":      ("3.1390",  "101.6869",  "Kuala Lumpur, Malaysia"),
  "Asia/Ho_Chi_Minh":       ("10.8231", "106.6297",  "Ho Chi Minh City, Vietnam"),
  "Australia/Sydney":       ("-33.8688","151.2093",  "Sydney, Australia"),
  "Australia/Melbourne":    ("-37.8136","144.9631",  "Melbourne, Australia"),
  "Australia/Brisbane":     ("-27.4698","153.0251",  "Brisbane, Australia"),
  "Pacific/Auckland":       ("-36.8485","174.7633",  "Auckland, New Zealand"),
  "Africa/Cairo":           ("30.0444", "31.2357",   "Cairo, Egypt"),
  "Africa/Johannesburg":    ("-26.2041","28.0473",   "Johannesburg, South Africa"),
  "Africa/Lagos":           ("6.5244",  "3.3792",    "Lagos, Nigeria"),
  "Africa/Nairobi":         ("-1.2921", "36.8219",   "Nairobi, Kenya"),
}

def api_get(url: str, token: str | None) -> dict | list | None:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "GitGlobe-Pipeline/2.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 403:
            print(f"\n  ⚠  Rate limited on {url[:60]}")
        elif e.code != 404:
            print(f"\n  ⚠  HTTP {e.code}")
        return None
    except Exception:
        return None

def geocode_string(raw: str) -> tuple[float, float, str] | None:
    """Multi-strategy geocoding from a location string."""
    if not raw or not raw.strip():
        return None
    text = raw.strip().lower()
    text = re.sub(r'[,\.\(\)\[\]]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    # Skip garbage
    skip = {"remote","worldwide","earth","internet","global","anywhere",
            "everywhere","none","null","n/a","unknown","web","online","world",
            "open source","the internet","planet earth","cyberspace"}
    if text in skip or len(text) < 2:
        return None

    # Direct match
    if text in CITY_MAP:
        v = CITY_MAP[text]
        return None if v is None else (float(v[0]), float(v[1]), v[2])

    # Substring match — longest key wins
    best_key, best_len = None, 0
    for key in CITY_MAP:
        if key in text and len(key) > best_len:
            best_key, best_len = key, len(key)
    if best_key:
        v = CITY_MAP[best_key]
        return None if v is None else (float(v[0]), float(v[1]), v[2])

    # Token match — split on spaces/commas
    tokens = re.split(r'[\s,]+', text)
    for token in tokens:
        if len(token) > 3 and token in CITY_MAP:
            v = CITY_MAP[token]
            if v:
                return float(v[0]), float(v[1]), v[2]

    return None

def geocode_from_timezone(tz: str) -> tuple[float, float, str] | None:
    if not tz:
        return None
    # Direct match
    if tz in TZ_MAP:
        v = TZ_MAP[tz]
        return float(v[0]), float(v[1]), v[2]
    # Prefix match (e.g. America/Indiana/Indianapolis → America/Chicago)
    prefix = tz.rsplit('/', 1)[0]
    for key, val in TZ_MAP.items():
        if key.startswith(prefix):
            return float(val[0]), float(val[1]), val[2]
    return None

def get_user_geo(username: str, token: str | None) -> tuple[float, float, str] | None:
    """Signal 1+2: profile location + profile timezone."""
    data = api_get(f"https://api.github.com/users/{username}", token)
    if not data or not isinstance(data, dict):
        return None
    # Signal 1 — location string
    loc = (data.get("location") or "").strip()
    if loc:
        result = geocode_string(loc)
        if result:
            return result
    # Signal 2 — timezone field (some users set this)
    tz = (data.get("timezone") or "").strip()
    if tz:
        result = geocode_from_timezone(tz)
        if result:
            return result
    return None

def get_org_geo(orgname: str, token: str | None) -> tuple[float, float, str] | None:
    """Signal 3: organisation location + country."""
    data = api_get(f"https://api.github.com/orgs/{orgname}", token)
    if not data or not isinstance(data, dict):
        return None
    loc = (data.get("location") or "").strip()
    if loc:
        result = geocode_string(loc)
        if result:
            return result
    return None

def get_contributor_geo(repo_full: str, token: str | None,
                        max_contributors: int = 5) -> tuple[float, float, str] | None:
    """Signal 4: sample top contributors' locations — majority vote."""
    data = api_get(
        f"https://api.github.com/repos/{repo_full}/contributors?per_page={max_contributors}",
        token
    )
    if not data or not isinstance(data, list):
        return None
    results: list[tuple[float, float, str]] = []
    for contrib in data[:max_contributors]:
        uname = contrib.get("login", "")
        if not uname:
            continue
        udata = api_get(f"https://api.github.com/users/{uname}", token)
        if not udata or not isinstance(udata, dict):
            continue
        loc = (udata.get("location") or "").strip()
        if loc:
            r = geocode_string(loc)
            if r:
                results.append(r)
        time.sleep(0.2 if token else 0.8)
    if not results:
        return None
    # Return most common country (by display name prefix)
    country_votes = Counter(r[2].split(',')[-1].strip() for r in results)
    best_country  = country_votes.most_common(1)[0][0]
    for r in results:
        if r[2].split(',')[-1].strip() == best_country:
            return r
    return results[0]

def waterfall_geocode(
    repo: dict,
    token: str | None,
    use_contributors: bool = True
) -> tuple[float, float, str] | None:
    """
    Full 4-signal waterfall:
    1. Owner/user profile location
    2. Owner profile timezone
    3. Organisation location (if org-owned)
    4. Contributor location sampling (majority vote)
    """
    owner      = repo.get("owner", {}).get("login", "")
    owner_type = repo.get("owner", {}).get("type", "")
    full_name  = repo.get("full_name", "")

    # Signal 1+2: user/owner profile
    result = get_user_geo(owner, token)
    time.sleep(0.25 if token else 1.0)
    if result:
        return result

    # Signal 3: org metadata
    if owner_type == "Organization":
        result = get_org_geo(owner, token)
        time.sleep(0.25 if token else 1.0)
        if result:
            return result

    # Signal 4: contributor sampling (only if allowed and token present)
    if use_contributors and token and full_name:
        result = get_contributor_geo(full_name, token, max_contributors=3)
        if result:
            return result

    return None

def fetch_repos(limit: int, token: str | None) -> list[dict]:
    queries = [
        "stars:>10000",
        "stars:>5000 language:Python",
        "stars:>5000 language:TypeScript",
        "stars:>5000 language:Rust",
        "stars:>5000 language:Go",
        "stars:>5000 language:Java",
        "stars:>3000 language:JavaScript",
        "stars:>2000 topic:machine-learning",
        "stars:>2000 topic:devtools",
        "stars:>1000 topic:cli",
        "stars:>1000 topic:database",
        "stars:>1000 topic:mobile",
    ]
    seen, all_repos = set(), []
    per_page = min(100, limit)

    print(f"\n{'─'*52}")
    print(f"  GitGlobe 2C — Improved Pipeline")
    print(f"  Target : {limit} repos")
    print(f"  Auth   : {'token ✓' if token else 'no token (60 req/hr)'}")
    print(f"{'─'*52}\n")

    for q in queries:
        if len(all_repos) >= limit:
            break
        url = (f"https://api.github.com/search/repositories"
               f"?q={urllib.parse.quote(q)}&sort=stars&order=desc&per_page={per_page}")
        print(f"  Fetching: {q[:52]:<52}", end=" ")
        data = api_get(url, token)
        if not data or "items" not in data:
            print("✗"); continue
        added = 0
        for item in data["items"]:
            if len(all_repos) >= limit:
                break
            if item["full_name"] in seen:
                continue
            seen.add(item["full_name"])
            all_repos.append(item)
            added += 1
        print(f"→ +{added} ({len(all_repos)} total)")
        time.sleep(1.0 if token else 3.0)

    return all_repos[:limit]

def process_repos(raw_repos: list[dict], token: str | None) -> list[dict]:
    results, geocoded, skipped = [], 0, 0
    total = len(raw_repos)
    print(f"\n  Processing {total} repos with 4-signal waterfall…\n")

    for i, repo in enumerate(raw_repos):
        name  = repo.get("full_name", "")
        owner = repo.get("owner", {}).get("login", "")
        sys.stdout.write(f"\r  [{i+1:>3}/{total}] {name:<52}")
        sys.stdout.flush()

        loc_result = waterfall_geocode(repo, token, use_contributors=bool(token))

        if loc_result:
            lat, lng, loc_str = loc_result
            geocoded += 1
        else:
            skipped += 1
            continue

        lang   = repo.get("language") or "Other"
        topics = repo.get("topics", [])
        record = {
            "name":   name,
            "desc":   (repo.get("description") or "")[:120],
            "stars":  repo.get("stargazers_count", 0),
            "forks":  repo.get("forks_count", 0),
            "lang":   lang,
            "owner":  owner,
            "lat":    round(lat, 4),
            "lng":    round(lng, 4),
            "loc":    loc_str,
            "topics": ",".join(topics[:6]) if topics else lang.lower(),
        }
        results.append(record)

    pct = round(geocoded / total * 100) if total else 0
    print(f"\n\n  {'─'*42}")
    print(f"  Geocoded : {geocoded}/{total} repos  ({pct}%)")
    print(f"  Skipped  : {skipped} (no location data)")
    print(f"  Output   : {len(results)} repos on globe")
    print(f"  {'─'*42}")
    return results

def save(repos: list[dict], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(repos, f, indent=2, ensure_ascii=False)
    kb = round(out_path.stat().st_size / 1024, 1)
    print(f"\n  Saved → {out_path}  ({kb} KB, {len(repos)} repos)\n")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--token", type=str, default=None)
    parser.add_argument("--no-contributors", action="store_true",
                        help="Skip contributor sampling (faster)")
    args = parser.parse_args()

    out = Path(__file__).parent.parent / "public" / "data" / "repos.json"
    raw = fetch_repos(args.limit, args.token)

    # Temporarily disable contributor sampling if flag set
    if args.no_contributors:
        for r in raw:
            r["_no_contrib"] = True

    repos = process_repos(raw, args.token)
    save(repos, out)
    print("  Done! Run: vercel --prod  to push to production.\n")

if __name__ == "__main__":
    main()
