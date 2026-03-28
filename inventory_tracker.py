"""
Inventory Tracker
Tracks Shopify store inventory over time via cart probing.
Stores snapshots in SQLite, computes sales deltas.
"""

import json
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

import requests

DB_PATH = Path(__file__).parent / "data" / "inventory.db"


def _get_db():
    """Get a SQLite connection (creates DB + tables if needed)."""
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tracked_stores (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            domain TEXT NOT NULL,
            added_at TEXT NOT NULL,
            last_scan_at TEXT,
            scan_interval_hours INTEGER DEFAULT 24,
            active INTEGER DEFAULT 1
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS inventory_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id TEXT NOT NULL,
            scanned_at TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_title TEXT,
            product_handle TEXT,
            variant_id TEXT NOT NULL,
            variant_title TEXT,
            price REAL,
            compare_at_price REAL,
            inventory_qty INTEGER,
            image_url TEXT,
            product_type TEXT,
            vendor TEXT,
            FOREIGN KEY (store_id) REFERENCES tracked_stores(id)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_snapshots_store_date
        ON inventory_snapshots(store_id, scanned_at)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_snapshots_variant
        ON inventory_snapshots(store_id, variant_id, scanned_at)
    """)
    conn.commit()
    return conn


def _normalize_url(store_url):
    store_url = store_url.strip().rstrip("/")
    if not store_url.startswith("http"):
        store_url = "https://" + store_url
    parsed = urlparse(store_url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _fetch_json(url, timeout=15):
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
    }
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def _cart_probe_inventory(base_url, variant_id):
    """
    Probe exact inventory for a variant using cart/add.js.
    Returns inventory quantity or None if probe fails.
    """
    try:
        # Clear cart first
        requests.post(
            f"{base_url}/cart/clear.js",
            headers={
                "User-Agent": "Mozilla/5.0",
                "Content-Type": "application/json",
            },
            timeout=10,
        )

        # Try adding a huge quantity
        resp = requests.post(
            f"{base_url}/cart/add.js",
            json={"id": variant_id, "quantity": 99999},
            headers={
                "User-Agent": "Mozilla/5.0",
                "Content-Type": "application/json",
            },
            timeout=10,
        )

        if resp.status_code == 200:
            data = resp.json()
            return data.get("quantity", None)
        elif resp.status_code == 422:
            # Product unavailable or out of stock
            return 0
    except Exception:
        pass
    return None


def _fetch_all_products_sorted(base_url):
    """Fetch all products sorted by best-selling."""
    products = []
    page = 1
    while True:
        url = f"{base_url}/products.json?sort_by=best-selling&limit=250&page={page}"
        try:
            data = _fetch_json(url)
        except Exception:
            break
        batch = data.get("products", [])
        if not batch:
            break
        products.extend(batch)
        if len(batch) < 250:
            break
        page += 1
        time.sleep(0.5)
    return products


# ---- Public API ----

def add_tracked_store(store_url):
    """Add a store to tracking. Returns store_id."""
    base_url = _normalize_url(store_url)
    domain = urlparse(base_url).netloc.replace("www.", "")
    store_id = str(uuid.uuid4())[:8]

    conn = _get_db()
    # Check if already tracked
    existing = conn.execute(
        "SELECT id FROM tracked_stores WHERE domain = ? AND active = 1", (domain,)
    ).fetchone()
    if existing:
        conn.close()
        return existing["id"]

    conn.execute(
        "INSERT INTO tracked_stores (id, url, domain, added_at) VALUES (?, ?, ?, ?)",
        (store_id, base_url, domain, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()
    return store_id


def get_tracked_stores():
    """Get all tracked stores."""
    conn = _get_db()
    rows = conn.execute(
        "SELECT * FROM tracked_stores WHERE active = 1 ORDER BY added_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def remove_tracked_store(store_id):
    """Deactivate a tracked store."""
    conn = _get_db()
    conn.execute("UPDATE tracked_stores SET active = 0 WHERE id = ?", (store_id,))
    conn.commit()
    conn.close()


def scan_store(store_id, job=None):
    """
    Run a full inventory scan for a store.
    Uses cart probing for top products, falls back to products.json data.
    """
    conn = _get_db()
    store = conn.execute("SELECT * FROM tracked_stores WHERE id = ?", (store_id,)).fetchone()
    if not store:
        conn.close()
        return {"error": "Store not found"}

    base_url = store["url"]
    scan_time = datetime.utcnow().isoformat()

    if job:
        job["status_message"] = "Recuperation des produits..."
        job["progress"] = 10

    # Fetch products sorted by best-selling
    products = _fetch_all_products_sorted(base_url)

    if not products:
        conn.close()
        return {"error": "Aucun produit trouve"}

    if job:
        job["status_message"] = f"{len(products)} produits trouves. Scan inventaire..."
        job["progress"] = 30

    total_variants = sum(len(p.get("variants", [])) for p in products)
    scanned = 0

    # Probe inventory for top products (cart probing is slow, limit to top 50)
    # For the rest, we'll track relative changes
    for p_idx, product in enumerate(products):
        images = product.get("images", [])
        first_image = images[0].get("src", "") if images else ""

        for variant in product.get("variants", []):
            variant_id = str(variant.get("id", ""))

            # Cart probe for top 50 products (most important for sales data)
            if p_idx < 50:
                qty = _cart_probe_inventory(base_url, variant_id)
                if qty is None:
                    # Fallback: use inventory_quantity if available
                    qty = variant.get("inventory_quantity")
                time.sleep(0.3)  # Rate limiting
            else:
                qty = variant.get("inventory_quantity")

            price = 0
            try:
                price = float(variant.get("price", 0))
            except (ValueError, TypeError):
                pass

            compare_price = None
            try:
                cp = variant.get("compare_at_price")
                if cp:
                    compare_price = float(cp)
            except (ValueError, TypeError):
                pass

            # Get variant-specific image
            variant_image_id = variant.get("image_id")
            var_image = first_image
            if variant_image_id:
                for img in images:
                    if img.get("id") == variant_image_id:
                        var_image = img.get("src", "")
                        break

            conn.execute("""
                INSERT INTO inventory_snapshots
                (store_id, scanned_at, product_id, product_title, product_handle,
                 variant_id, variant_title, price, compare_at_price, inventory_qty,
                 image_url, product_type, vendor)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                store_id, scan_time,
                str(product.get("id", "")),
                product.get("title", ""),
                product.get("handle", ""),
                variant_id,
                variant.get("title", ""),
                price,
                compare_price,
                qty,
                var_image,
                product.get("product_type", ""),
                product.get("vendor", ""),
            ))

            scanned += 1
            if job and scanned % 10 == 0:
                pct = 30 + int((scanned / max(total_variants, 1)) * 60)
                job["progress"] = min(pct, 90)
                job["status_message"] = f"Scan: {scanned}/{total_variants} variantes..."

    # Update last scan time
    conn.execute(
        "UPDATE tracked_stores SET last_scan_at = ? WHERE id = ?",
        (scan_time, store_id),
    )
    conn.commit()
    conn.close()

    if job:
        job["progress"] = 100
        job["status"] = "done"
        job["status_message"] = f"Scan termine ! {len(products)} produits, {scanned} variantes"

    return {"products": len(products), "variants": scanned, "scan_time": scan_time}


def get_store_sales_data(store_id, days=30):
    """
    Compute sales data by comparing inventory snapshots over time.
    Returns ranked products with estimated sales.
    """
    conn = _get_db()
    store = conn.execute("SELECT * FROM tracked_stores WHERE id = ?", (store_id,)).fetchone()
    if not store:
        conn.close()
        return None

    # Get distinct scan dates
    scans = conn.execute("""
        SELECT DISTINCT scanned_at FROM inventory_snapshots
        WHERE store_id = ?
        ORDER BY scanned_at ASC
    """, (store_id,)).fetchall()

    scan_dates = [s["scanned_at"] for s in scans]

    if len(scan_dates) < 1:
        conn.close()
        return {"store": dict(store), "products": [], "scan_count": 0, "message": "Aucun scan disponible"}

    # Get the oldest and newest scan within the requested period
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    relevant_scans = [s for s in scan_dates if s >= cutoff]
    if not relevant_scans:
        relevant_scans = scan_dates  # Use all if none in range

    first_scan = relevant_scans[0]
    last_scan = relevant_scans[-1]

    # Get first snapshot data per variant
    first_data = conn.execute("""
        SELECT product_id, product_title, product_handle, variant_id, variant_title,
               price, compare_at_price, inventory_qty, image_url, product_type, vendor
        FROM inventory_snapshots
        WHERE store_id = ? AND scanned_at = ?
    """, (store_id, first_scan)).fetchall()

    # Get last snapshot data per variant
    last_data = conn.execute("""
        SELECT product_id, product_title, product_handle, variant_id, variant_title,
               price, compare_at_price, inventory_qty, image_url, product_type, vendor
        FROM inventory_snapshots
        WHERE store_id = ? AND scanned_at = ?
    """, (store_id, last_scan)).fetchall()

    conn.close()

    # Build lookup by variant_id
    first_map = {r["variant_id"]: dict(r) for r in first_data}
    last_map = {r["variant_id"]: dict(r) for r in last_data}

    # Calculate days between scans
    try:
        dt_first = datetime.fromisoformat(first_scan)
        dt_last = datetime.fromisoformat(last_scan)
        delta_days = max((dt_last - dt_first).total_seconds() / 86400, 0.01)
    except Exception:
        delta_days = 1

    # Aggregate sales by product
    product_sales = {}  # product_id -> {title, total_sold, revenue, ...}

    for variant_id, last in last_map.items():
        first = first_map.get(variant_id)
        if not first:
            continue

        first_qty = first.get("inventory_qty")
        last_qty = last.get("inventory_qty")

        if first_qty is None or last_qty is None:
            continue

        # Sales = inventory decrease (ignore restocks — if qty went up, sales = 0 for that period)
        sold = max(0, first_qty - last_qty)

        pid = last["product_id"]
        if pid not in product_sales:
            product_sales[pid] = {
                "product_id": pid,
                "title": last["product_title"],
                "handle": last["product_handle"],
                "image": last["image_url"],
                "product_type": last["product_type"],
                "vendor": last["vendor"],
                "price": last["price"],
                "compare_at_price": last["compare_at_price"],
                "total_sold": 0,
                "total_revenue": 0,
                "variants_tracked": 0,
                "current_stock": 0,
            }

        product_sales[pid]["total_sold"] += sold
        product_sales[pid]["total_revenue"] += sold * (last["price"] or 0)
        product_sales[pid]["variants_tracked"] += 1
        product_sales[pid]["current_stock"] += (last_qty or 0)

    # Sort by total_sold descending
    ranked = sorted(product_sales.values(), key=lambda x: x["total_sold"], reverse=True)

    # Add rank, extrapolate to 30 days, and add ad links
    for rank, p in enumerate(ranked, 1):
        p["rank"] = rank

        # Extrapolate to 30 days
        if delta_days < 30:
            multiplier = 30 / delta_days
            p["monthly_sales_est"] = int(p["total_sold"] * multiplier)
            p["monthly_revenue_est"] = round(p["total_revenue"] * multiplier, 2)
        else:
            p["monthly_sales_est"] = p["total_sold"]
            p["monthly_revenue_est"] = round(p["total_revenue"], 2)

        p["daily_sales"] = round(p["total_sold"] / delta_days, 1)

        # Ad links
        search_term = p["vendor"] if p["vendor"] else p["title"].split(" ")[0]
        p["fb_ads_link"] = f"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q={requests.utils.quote(search_term)}"
        p["tiktok_ads_link"] = f"https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?keyword={requests.utils.quote(p['title'][:50])}&period=30&sort_by=like"
        p["product_url"] = f"{store['url']}/products/{p['handle']}"

    total_revenue = sum(p["monthly_revenue_est"] for p in ranked)

    return {
        "store": dict(store),
        "products": ranked,
        "scan_count": len(scan_dates),
        "first_scan": first_scan,
        "last_scan": last_scan,
        "delta_days": round(delta_days, 1),
        "total_monthly_revenue_est": round(total_revenue, 2),
        "is_single_scan": len(scan_dates) == 1,
    }


# ---- Background Scanner (Cron) ----

_scanner_thread = None
_scanner_running = False


def _cron_loop():
    """Background loop that scans all tracked stores periodically."""
    global _scanner_running
    while _scanner_running:
        try:
            conn = _get_db()
            stores = conn.execute(
                "SELECT * FROM tracked_stores WHERE active = 1"
            ).fetchall()
            conn.close()

            now = datetime.utcnow()

            for store in stores:
                interval = store["scan_interval_hours"] or 24
                last_scan = store["last_scan_at"]

                should_scan = False
                if not last_scan:
                    should_scan = True
                else:
                    try:
                        last_dt = datetime.fromisoformat(last_scan)
                        if (now - last_dt).total_seconds() >= interval * 3600:
                            should_scan = True
                    except Exception:
                        should_scan = True

                if should_scan:
                    print(f"[Tracker] Auto-scan: {store['domain']}...")
                    try:
                        result = scan_store(store["id"])
                        print(f"[Tracker] Done: {store['domain']} - {result}")
                    except Exception as e:
                        print(f"[Tracker] Error scanning {store['domain']}: {e}")

        except Exception as e:
            print(f"[Tracker] Cron error: {e}")

        # Check every 10 minutes if any store needs scanning
        for _ in range(60):  # 60 * 10s = 10 min
            if not _scanner_running:
                break
            time.sleep(10)


def start_background_scanner():
    """Start the background cron scanner."""
    global _scanner_thread, _scanner_running
    if _scanner_running:
        return
    _scanner_running = True
    _scanner_thread = threading.Thread(target=_cron_loop, daemon=True)
    _scanner_thread.start()
    print("[Tracker] Background scanner started (checks every 10min)")


def stop_background_scanner():
    global _scanner_running
    _scanner_running = False


# ---- Scan Jobs (for async scanning via UI) ----

scan_jobs = {}


def _run_scan_job(job):
    try:
        job["status"] = "scanning"
        result = scan_store(job["store_id"], job=job)
        if isinstance(result, dict) and "error" in result:
            job["status"] = "error"
            job["error"] = result["error"]
        else:
            job["status"] = "done"
            job["result"] = result
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


def start_scan_job(store_id):
    job_id = str(uuid.uuid4())[:8]
    job = {
        "id": job_id,
        "store_id": store_id,
        "status": "queued",
        "progress": 0,
        "status_message": "En attente...",
        "result": None,
        "error": None,
    }
    scan_jobs[job_id] = job
    thread = threading.Thread(target=_run_scan_job, args=(job,), daemon=True)
    thread.start()
    return job_id


def get_scan_job(job_id):
    return scan_jobs.get(job_id)
