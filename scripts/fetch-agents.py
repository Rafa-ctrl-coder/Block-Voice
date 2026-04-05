#!/usr/bin/env python3
"""Fetch top UK managing agents from Companies House and save as JSON for static page generation."""
import json, time, urllib.request, urllib.parse, base64, re, sys

API_KEY = "8a6d6a93-1037-44a5-867b-726e42dd1155"
AUTH = base64.b64encode(f"{API_KEY}:".encode()).decode()

# Top UK residential managing agents (curated list)
AGENTS = [
    "Rendall & Rittner", "FirstPort Property Management", "RMG", "Savills Property Management",
    "JLL Property Management", "CBRE Residential Management", "Cushman & Wakefield",
    "Knight Frank LLP", "Mainstay Group", "Braemar Estates", "Gallard Homes",
    "Harrods Estates", "Grainger PLC", "Greystar Europe Holdings", "Ballymore Group",
    "Berkeley Group Holdings", "Barratt Developments", "Mount Anvil",
    "BPS Estate Management", "Fizzy Living", "Moda Living", "Dexters",
    "Foxtons", "Kinleigh Folkard & Hayward", "Marsh & Parsons", "Winkworth",
    "Benham and Reeves", "Chestertons", "Ludgate Property Management",
    "Conway Estates", "HML Group", "RMG Premium", "Pinnacle Places",
    "Freehold Managers", "Property Hub", "St George PLC",
    "St James Group", "Taylor Wimpey", "Redrow Homes", "Bellway Homes",
    "Persimmon Homes", "Crest Nicholson", "L&Q Housing", "Peabody",
    "Hyde Housing", "Metropolitan Thames Valley", "A2Dominion",
    "Notting Hill Genesis", "Southern Housing", "PA Housing",
    "Sanctuary Housing", "Places for People", "Home Group",
    "Clarion Housing", "Stonewater", "Sovereign Housing",
    "Longhurst Group", "Orbit Group", "Midland Heart",
    "Bromford Housing", "LiveWest", "Riverside Housing",
    "Together Housing", "Anchor Hanover", "McCarthy Stone",
    "Churchill Retirement", "Inspired Villages", "Audley Group",
    "Retirement Villages", "ExtraCare Charitable Trust",
    "Pegasus Group", "PegasusLife", "Cartwright Pickard",
    "Lendlease", "Multiplex", "Mace Group",
    "Vistry Group", "Countryside Properties", "Galliford Try",
    "Kier Group", "Morgan Sindall", "Willmott Dixon",
    "ISG", "Wates Group", "BAM Construction",
    "Bouygues UK", "Skanska UK", "Laing O'Rourke",
    "VolkerWessels UK", "John Sisk", "McAlpine",
    "Travis Perkins", "Howdens Joinery",
    "Warwick Estates", "Remus Management", "Chamonix Estates",
    "Brady Solicitors", "Ringley Group", "PMS Managing Agents",
    "Encore Estate Management", "Residential Management Group",
    "FirstPort", "Places For People Living Plus",
    "Peabody South East", "Optivo", "Paradigm Housing",
    "DAMAC Properties", "EcoWorld International",
    "R&F Properties", "CC Land Holdings",
    "SP Setia", "Sime Darby Property",
    "Hutchison Property", "CK Asset Holdings",
    "Canary Wharf Group", "British Land",
    "Land Securities", "Great Portland Estates",
    "Derwent London", "Shaftesbury Capital",
    "Capital & Counties", "Helical", "Workspace Group",
    "McKay Securities", "Town Centre Securities",
    "Assura", "Primary Health Properties",
    "Tritax Big Box", "Segro", "Unite Students",
    "Empiric Student Property", "GCP Student Living",
    "CLS Holdings", "Sirius Real Estate",
    "Palace Capital", "Inland Homes",
    "Telford Homes", "Regal London",
    "Lodha UK", "Northacre", "Finchatton",
    "Candy & Candy", "One Hyde Park",
    "Almacantar", "Ronson Capital Partners",
    "Stanhope", "Argent", "Related Argent",
    "U+I Group", "Quintain", "Essential Living",
    "Tipi", "Fizzy Living", "Get Living",
    "Legal & General Modular Homes",
    "Pocket Living", "Dolphin Living",
    "Elim Housing", "Catalyst Housing",
    "Network Homes", "Origin Housing",
    "Wandle Housing", "One Housing",
    "Family Mosaic", "East Thames",
    "Circle Housing", "Affinity Sutton",
    "Genesis Housing", "Thames Valley Housing",
    "Paragon Housing", "Aster Group",
    "Guinness Partnership", "Great Places",
    "Accent Group", "Karbon Homes",
    "Bernicia Group", "Thirteen Group",
    "Tees Valley Housing", "Beyond Housing",
    "Yorkshire Housing", "Leeds Federated",
    "Incommunities", "Manningham Housing",
    "Jigsaw Homes", "Onward Homes",
    "Torus Group", "Your Housing Group",
    "Magenta Living", "Plus Dane Housing",
    "Muir Group", "Wrekin Housing",
    "Platform Housing", "Waterloo Housing",
    "Trident Housing", "Rooftop Housing",
    "Fortis Living", "Connexus", "Bournville Village Trust",
]

def slugify(name):
    s = name.lower()
    s = re.sub(r'[&+]', '-and-', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    return s

def search_company(query):
    url = f"https://api.company-information.service.gov.uk/search/companies?q={urllib.parse.quote(query)}&items_per_page=1"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Basic {AUTH}")
    req.add_header("Accept", "application/json")
    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read())
        items = data.get("items", [])
        if items:
            return items[0]
    except Exception as e:
        print(f"  Error searching {query}: {e}", file=sys.stderr)
    return None

def get_company_details(company_number):
    url = f"https://api.company-information.service.gov.uk/company/{company_number}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Basic {AUTH}")
    req.add_header("Accept", "application/json")
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except:
        return None

agents = []
seen_numbers = set()

for i, name in enumerate(AGENTS):
    result = search_company(name)
    if not result:
        continue

    cn = result.get("company_number", "")
    if cn in seen_numbers:
        continue
    seen_numbers.add(cn)

    # Get full details
    details = get_company_details(cn)
    if not details:
        continue

    addr = details.get("registered_office_address", {})
    sic = details.get("sic_codes", [])

    agent = {
        "name": details.get("company_name", result.get("title", name)),
        "slug": slugify(details.get("company_name", name)),
        "company_number": cn,
        "status": details.get("company_status", "unknown"),
        "incorporated": details.get("date_of_creation", ""),
        "address": {
            "line1": addr.get("address_line_1", ""),
            "line2": addr.get("address_line_2", ""),
            "locality": addr.get("locality", ""),
            "region": addr.get("region", ""),
            "postal_code": addr.get("postal_code", ""),
            "country": addr.get("country", ""),
        },
        "sic_codes": sic,
        "type": details.get("type", ""),
    }
    agents.append(agent)

    if (i + 1) % 10 == 0:
        print(f"Processed {i+1}/{len(AGENTS)} ({len(agents)} found)", file=sys.stderr)

    time.sleep(0.6)  # Rate limit: 600/min

# Save
output_path = "/Users/rafaelziahaq/Documents/blockvoice/.claude/worktrees/modest-brattain/data/agents.json"
import os
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w") as f:
    json.dump(agents, f, indent=2)

print(f"\nDone. Saved {len(agents)} agents to {output_path}", file=sys.stderr)
