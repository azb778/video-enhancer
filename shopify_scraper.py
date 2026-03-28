"""
Shopify Store Scraper
Scrapes products from any Shopify store via their public JSON API.
Exports to CSV in Shopify-compatible format.
"""

import csv
import io
import json
import threading
import time
import uuid
from urllib.parse import urlparse

import requests

# Job storage
scrape_jobs = {}

OUTPUT_DIR = None  # Set from app.py

SHOPIFY_CSV_HEADERS = [
    "Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Tags",
    "Published", "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value",
    "Option3 Name", "Option3 Value", "Variant SKU", "Variant Grams",
    "Variant Inventory Tracker", "Variant Inventory Policy", "Variant Fulfillment Service",
    "Variant Price", "Variant Compare At Price", "Variant Requires Shipping",
    "Variant Taxable", "Variant Barcode", "Image Src", "Image Position", "Image Alt Text",
    "Gift Card", "SEO Title", "SEO Description", "Variant Image", "Variant Weight Unit",
    "Cost per item", "Status",
]


def _normalize_url(store_url):
    """Normalize store URL to base domain."""
    store_url = store_url.strip().rstrip("/")
    if not store_url.startswith("http"):
        store_url = "https://" + store_url
    parsed = urlparse(store_url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _fetch_json(url, timeout=15):
    """Fetch JSON from a URL with a browser-like User-Agent."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
    }
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def fetch_collections(store_url):
    """Fetch all collections from a Shopify store."""
    base = _normalize_url(store_url)
    collections = []
    page = 1

    while True:
        url = f"{base}/collections.json?limit=250&page={page}"
        try:
            data = _fetch_json(url)
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                # Try alternative: some stores don't expose collections.json
                break
            raise
        except Exception:
            break

        batch = data.get("collections", [])
        if not batch:
            break

        for c in batch:
            collections.append({
                "handle": c.get("handle", ""),
                "title": c.get("title", ""),
                "id": c.get("id", ""),
                "products_count": c.get("products_count", 0),
                "image": (c.get("image") or {}).get("src", ""),
            })

        if len(batch) < 250:
            break
        page += 1

    return collections


def _fetch_all_products(base_url, job=None):
    """Fetch all products from a Shopify store (paginated)."""
    products = []
    page = 1

    while True:
        url = f"{base_url}/products.json?limit=250&page={page}"
        try:
            data = _fetch_json(url)
        except Exception:
            break

        batch = data.get("products", [])
        if not batch:
            break

        products.extend(batch)

        if job:
            job["status_message"] = f"{len(products)} produits trouves..."

        if len(batch) < 250:
            break
        page += 1
        time.sleep(0.5)  # Be polite

    return products


def _fetch_collection_products(base_url, collection_handle, job=None):
    """Fetch all products from a specific collection."""
    products = []
    page = 1

    while True:
        url = f"{base_url}/collections/{collection_handle}/products.json?limit=250&page={page}"
        try:
            data = _fetch_json(url)
        except Exception:
            break

        batch = data.get("products", [])
        if not batch:
            break

        products.extend(batch)

        if job:
            job["status_message"] = f"{len(products)} produits trouves dans '{collection_handle}'..."

        if len(batch) < 250:
            break
        page += 1
        time.sleep(0.5)

    return products


def _products_to_csv_rows(products):
    """Convert Shopify product JSON to CSV rows (Shopify export format)."""
    rows = []

    for product in products:
        handle = product.get("handle", "")
        title = product.get("title", "")
        body_html = product.get("body_html", "") or ""
        vendor = product.get("vendor", "")
        product_type = product.get("product_type", "")
        tags = product.get("tags", [])
        if isinstance(tags, list):
            tags = ", ".join(tags)
        published = "true" if product.get("published_at") else "false"
        status = product.get("status", "active")

        variants = product.get("variants", [])
        images = product.get("images", [])
        options = product.get("options", [])

        # Build image list
        image_srcs = [img.get("src", "") for img in images]

        # For each variant, create a row
        for v_idx, variant in enumerate(variants):
            row = {h: "" for h in SHOPIFY_CSV_HEADERS}

            if v_idx == 0:
                # First variant row has product-level info
                row["Handle"] = handle
                row["Title"] = title
                row["Body (HTML)"] = body_html
                row["Vendor"] = vendor
                row["Type"] = product_type
                row["Tags"] = tags
                row["Published"] = published
                row["Gift Card"] = "false"
                row["Status"] = status
            else:
                row["Handle"] = handle

            # Options
            for o_idx, option in enumerate(options):
                if o_idx >= 3:
                    break
                opt_num = o_idx + 1
                if v_idx == 0:
                    row[f"Option{opt_num} Name"] = option.get("name", "")
                row[f"Option{opt_num} Value"] = variant.get(f"option{opt_num}", "") or ""

            # Variant info
            row["Variant SKU"] = variant.get("sku", "") or ""
            row["Variant Grams"] = str(variant.get("grams", 0) or 0)
            row["Variant Inventory Tracker"] = variant.get("inventory_management", "") or ""
            row["Variant Inventory Policy"] = variant.get("inventory_policy", "deny")
            row["Variant Fulfillment Service"] = variant.get("fulfillment_service", "manual")
            row["Variant Price"] = str(variant.get("price", ""))
            row["Variant Compare At Price"] = str(variant.get("compare_at_price", "") or "")
            row["Variant Requires Shipping"] = str(variant.get("requires_shipping", True)).lower()
            row["Variant Taxable"] = str(variant.get("taxable", True)).lower()
            row["Variant Barcode"] = variant.get("barcode", "") or ""
            row["Variant Weight Unit"] = variant.get("weight_unit", "kg")

            # Variant image
            variant_image_id = variant.get("image_id")
            if variant_image_id:
                for img in images:
                    if img.get("id") == variant_image_id:
                        row["Variant Image"] = img.get("src", "")
                        break

            # Images: assign one image per variant row (first variant gets first image, etc.)
            if v_idx < len(image_srcs):
                row["Image Src"] = image_srcs[v_idx]
                row["Image Position"] = str(v_idx + 1)
                row["Image Alt Text"] = ""

            rows.append(row)

        # If there are more images than variants, add extra rows for remaining images
        if len(image_srcs) > len(variants):
            for img_idx in range(len(variants), len(image_srcs)):
                row = {h: "" for h in SHOPIFY_CSV_HEADERS}
                row["Handle"] = handle
                row["Image Src"] = image_srcs[img_idx]
                row["Image Position"] = str(img_idx + 1)
                rows.append(row)

        # If no variants at all, still add one row
        if not variants:
            row = {h: "" for h in SHOPIFY_CSV_HEADERS}
            row["Handle"] = handle
            row["Title"] = title
            row["Body (HTML)"] = body_html
            row["Vendor"] = vendor
            row["Type"] = product_type
            row["Tags"] = tags
            row["Published"] = published
            row["Gift Card"] = "false"
            row["Status"] = status
            if image_srcs:
                row["Image Src"] = image_srcs[0]
                row["Image Position"] = "1"
            rows.append(row)

    return rows


def _generate_csv_file(rows, output_path):
    """Write CSV rows to file."""
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=SHOPIFY_CSV_HEADERS)
        writer.writeheader()
        writer.writerows(rows)


def _run_scrape(job):
    """Background thread function for scraping."""
    try:
        base_url = _normalize_url(job["store_url"])
        collections = job.get("collections", [])  # list of handles, or empty = all

        job["status"] = "scraping"
        job["status_message"] = "Connexion a la boutique..."
        job["progress"] = 10

        all_products = []

        if not collections:
            # Scrape entire store
            job["status_message"] = "Recuperation de tous les produits..."
            all_products = _fetch_all_products(base_url, job)
        else:
            # Scrape selected collections
            for i, handle in enumerate(collections):
                job["status_message"] = f"Collection {i+1}/{len(collections)}: {handle}..."
                job["progress"] = 10 + int((i / len(collections)) * 60)
                products = _fetch_collection_products(base_url, handle, job)
                all_products.extend(products)

        # Deduplicate by product id
        seen_ids = set()
        unique_products = []
        for p in all_products:
            pid = p.get("id")
            if pid not in seen_ids:
                seen_ids.add(pid)
                unique_products.append(p)

        job["products_count"] = len(unique_products)
        job["progress"] = 75
        job["status_message"] = f"{len(unique_products)} produits uniques trouves. Generation du CSV..."

        # Convert to CSV
        rows = _products_to_csv_rows(unique_products)
        job["rows_count"] = len(rows)

        # Write CSV
        from pathlib import Path
        output_dir = OUTPUT_DIR or Path("output")
        output_dir.mkdir(exist_ok=True)
        output_path = output_dir / f"shopify_export_{job['id']}.csv"
        _generate_csv_file(rows, output_path)

        job["output_file"] = str(output_path)
        job["progress"] = 100
        job["status"] = "done"
        job["status_message"] = f"Termine ! {len(unique_products)} produits exportes ({len(rows)} lignes CSV)"

    except requests.exceptions.ConnectionError:
        job["status"] = "error"
        job["error"] = "Impossible de se connecter a la boutique. Verifiez l'URL."
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401 or e.response.status_code == 403:
            job["status"] = "error"
            job["error"] = "Acces refuse. Cette boutique bloque peut-etre l'acces a son API."
        else:
            job["status"] = "error"
            job["error"] = f"Erreur HTTP {e.response.status_code}"
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


def start_scrape_job(store_url, collections=None):
    """Start a scraping job in background."""
    job_id = str(uuid.uuid4())[:8]
    job = {
        "id": job_id,
        "store_url": store_url,
        "collections": collections or [],
        "status": "queued",
        "progress": 0,
        "status_message": "En attente...",
        "products_count": 0,
        "rows_count": 0,
        "output_file": None,
        "error": None,
    }
    scrape_jobs[job_id] = job

    thread = threading.Thread(target=_run_scrape, args=(job,), daemon=True)
    thread.start()

    return job_id


def get_scrape_job(job_id):
    return scrape_jobs.get(job_id)


# ---- Shop Analysis (Best Sellers + Revenue Estimation) ----

analyse_jobs = {}


def _fetch_best_sellers(base_url, job=None):
    """Fetch products sorted by best-selling."""
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

        if job:
            job["status_message"] = f"{len(products)} produits recuperes..."

        if len(batch) < 250:
            break
        page += 1
        time.sleep(0.5)

    return products


def _estimate_monthly_revenue(products):
    """
    Estimate monthly revenue based on best-seller ranking and price.

    Heuristic:
    - Rank 1 product: ~30 sales/day (top seller)
    - Exponential decay: each subsequent rank sells ~85% of previous
    - Capped at minimum 0.5 sales/day for tail products
    - Monthly = daily * 30
    """
    results = []
    total_revenue = 0

    for rank, product in enumerate(products, 1):
        # Get the main price (first variant)
        variants = product.get("variants", [])
        prices = []
        for v in variants:
            try:
                p = float(v.get("price", 0))
                if p > 0:
                    prices.append(p)
            except (ValueError, TypeError):
                pass

        price = min(prices) if prices else 0
        price_max = max(prices) if prices else price
        avg_price = sum(prices) / len(prices) if prices else 0

        # Estimate daily sales based on rank (exponential decay)
        daily_sales = max(0.5, 30 * (0.85 ** (rank - 1)))

        # Adjust for price (expensive items typically sell less)
        if avg_price > 100:
            daily_sales *= 0.6
        elif avg_price > 200:
            daily_sales *= 0.3

        monthly_sales = int(daily_sales * 30)
        monthly_revenue = round(monthly_sales * avg_price, 2)
        total_revenue += monthly_revenue

        # Get first image
        images = product.get("images", [])
        image_src = images[0].get("src", "") if images else ""

        # Build ad library search links
        title = product.get("title", "")
        vendor = product.get("vendor", "")
        search_term = vendor if vendor else title.split(" ")[0]

        fb_search = f"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q={requests.utils.quote(search_term)}"
        tiktok_search = f"https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?keyword={requests.utils.quote(title[:50])}&period=30&sort_by=like"

        results.append({
            "rank": rank,
            "title": title,
            "handle": product.get("handle", ""),
            "vendor": vendor,
            "product_type": product.get("product_type", ""),
            "price": f"{avg_price:.2f}",
            "price_range": f"{price:.2f} - {price_max:.2f}" if price != price_max else f"{price:.2f}",
            "monthly_sales_est": monthly_sales,
            "monthly_revenue_est": f"{monthly_revenue:.2f}",
            "image": image_src,
            "variants_count": len(variants),
            "created_at": product.get("created_at", ""),
            "fb_ads_link": fb_search,
            "tiktok_ads_link": tiktok_search,
            "product_url": "",  # Will be set with base_url
        })

    return results, round(total_revenue, 2)


def _run_analyse(job):
    """Background thread for shop analysis."""
    try:
        base_url = _normalize_url(job["store_url"])

        job["status"] = "scraping"
        job["status_message"] = "Connexion a la boutique..."
        job["progress"] = 10

        # Fetch best sellers
        products = _fetch_best_sellers(base_url, job)

        if not products:
            job["status"] = "error"
            job["error"] = "Aucun produit trouve. Verifiez l'URL."
            return

        job["progress"] = 60
        job["status"] = "analyzing"
        job["status_message"] = f"Analyse de {len(products)} produits..."

        # Estimate revenue
        results, total_revenue = _estimate_monthly_revenue(products)

        # Add product URLs
        for r in results:
            r["product_url"] = f"{base_url}/products/{r['handle']}"

        # Extract store name from URL
        from urllib.parse import urlparse
        store_domain = urlparse(base_url).netloc.replace("www.", "")

        job["store_name"] = store_domain
        job["total_products"] = len(products)
        job["total_revenue_est"] = f"{total_revenue:.2f}"
        job["products"] = results  # Full ranked list
        job["progress"] = 100
        job["status"] = "done"
        job["status_message"] = f"Analyse terminee ! {len(products)} produits, CA estime: {total_revenue:.0f} EUR/mois"

    except requests.exceptions.ConnectionError:
        job["status"] = "error"
        job["error"] = "Impossible de se connecter a la boutique. Verifiez l'URL."
    except requests.exceptions.HTTPError as e:
        job["status"] = "error"
        job["error"] = f"Erreur HTTP {e.response.status_code}"
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


def start_analyse_job(store_url):
    """Start a shop analysis job in background."""
    job_id = str(uuid.uuid4())[:8]
    job = {
        "id": job_id,
        "store_url": store_url,
        "status": "queued",
        "progress": 0,
        "status_message": "En attente...",
        "store_name": "",
        "total_products": 0,
        "total_revenue_est": "0",
        "products": [],
        "error": None,
    }
    analyse_jobs[job_id] = job

    thread = threading.Thread(target=_run_analyse, args=(job,), daemon=True)
    thread.start()

    return job_id


def get_analyse_job(job_id):
    return analyse_jobs.get(job_id)
