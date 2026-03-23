#!/usr/bin/env python3
"""
AUTO-APPLY AGENT — FDE / AI Deployment Roles
=============================================
Automates job applications on Greenhouse, Ashby, and Lever ATS platforms.
Opens a VISIBLE browser, pre-fills your info, uploads resume, then PAUSES
for your review before submitting.

Setup:
    pip install playwright
    playwright install chromium

Usage:
    python auto_apply.py                          # Interactive mode
    python auto_apply.py <url>                    # Apply to single URL
    python auto_apply.py --batch urls.txt         # Batch apply from file
    python auto_apply.py --batch urls.txt --auto  # Auto-submit (no pause)
"""

import asyncio
import sys
import json
import os
import re
from datetime import datetime
from pathlib import Path

# ============================================================
# YOUR PROFILE — EDIT THESE
# ============================================================

PROFILE = {
    "first_name": "Aaron",
    "last_name": "",           # ← Fill in
    "email": "",               # ← Fill in
    "phone": "",               # ← Fill in
    "location": "New York, NY",
    "linkedin": "",            # ← Full URL
    "website": "",             # ← Portfolio URL
    "github": "",              # ← GitHub URL
    "resume_path": "",         # ← Absolute path to your resume PDF
    "current_company": "Jefferies",
    "current_title": "Forward Deployed Engineer, AI Strategy",
    "years_experience": "5",
    "work_authorization": "Yes",  # US work authorization
    "sponsorship_needed": "No",
    "salary_expectation": "",     # Leave blank to skip
    "start_date": "Immediately",
    "how_heard": "Company website",
}

# Log file for tracking submissions
LOG_FILE = "applications_log.json"

# ============================================================
# ATS DETECTION
# ============================================================

def detect_ats(url: str) -> str:
    """Detect which ATS platform a URL belongs to."""
    url_lower = url.lower()
    if "greenhouse.io" in url_lower or "boards.greenhouse" in url_lower:
        return "greenhouse"
    elif "ashbyhq.com" in url_lower:
        return "ashby"
    elif "lever.co" in url_lower:
        return "lever"
    elif "myworkdayjobs" in url_lower:
        return "workday"
    elif "careers.google.com" in url_lower:
        return "google"
    elif "salesforce.com" in url_lower or "careers.salesforce" in url_lower:
        return "salesforce"
    else:
        return "unknown"

# ============================================================
# FORM FILLING HELPERS
# ============================================================

async def safe_fill(page, selector, value, timeout=3000):
    """Try to fill a form field, skip if not found."""
    if not value:
        return False
    try:
        el = await page.wait_for_selector(selector, timeout=timeout)
        if el:
            await el.click()
            await el.fill("")
            await el.fill(value)
            return True
    except:
        pass
    return False

async def safe_select(page, selector, value, timeout=3000):
    """Try to select a dropdown option."""
    if not value:
        return False
    try:
        el = await page.wait_for_selector(selector, timeout=timeout)
        if el:
            await el.select_option(label=value)
            return True
    except:
        try:
            el = await page.wait_for_selector(selector, timeout=1000)
            if el:
                await el.select_option(value=value)
                return True
        except:
            pass
    return False

async def safe_upload(page, selector, file_path, timeout=5000):
    """Try to upload a file."""
    if not file_path or not Path(file_path).exists():
        print(f"  ⚠️  Resume not found at: {file_path}")
        return False
    try:
        el = await page.wait_for_selector(selector, timeout=timeout)
        if el:
            await el.set_input_files(file_path)
            return True
    except:
        pass
    return False

async def try_fill_by_patterns(page, patterns, value, timeout=2000):
    """Try multiple selector patterns to fill a field."""
    if not value:
        return False
    for pattern in patterns:
        if await safe_fill(page, pattern, value, timeout):
            return True
    return False

# ============================================================
# GREENHOUSE APPLICATION
# ============================================================

async def apply_greenhouse(page, profile, auto_submit=False):
    """Fill out a Greenhouse application form."""
    print("  🟢 Detected: Greenhouse")

    # Wait for form to load
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    # Check if we need to click "Apply" button first
    try:
        apply_btn = await page.wait_for_selector('a:has-text("Apply"), button:has-text("Apply for this job"), a:has-text("Apply for this job")', timeout=3000)
        if apply_btn:
            await apply_btn.click()
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
    except:
        pass

    filled = {}

    # First name
    r = await try_fill_by_patterns(page, [
        'input[name*="first_name"]', 'input[id*="first_name"]',
        'input[name*="firstName"]', 'input[autocomplete="given-name"]',
    ], profile["first_name"])
    if r: filled["first_name"] = True

    # Last name
    r = await try_fill_by_patterns(page, [
        'input[name*="last_name"]', 'input[id*="last_name"]',
        'input[name*="lastName"]', 'input[autocomplete="family-name"]',
    ], profile["last_name"])
    if r: filled["last_name"] = True

    # Email
    r = await try_fill_by_patterns(page, [
        'input[name*="email"]', 'input[id*="email"]',
        'input[type="email"]', 'input[autocomplete="email"]',
    ], profile["email"])
    if r: filled["email"] = True

    # Phone
    r = await try_fill_by_patterns(page, [
        'input[name*="phone"]', 'input[id*="phone"]',
        'input[type="tel"]', 'input[autocomplete="tel"]',
    ], profile["phone"])
    if r: filled["phone"] = True

    # Location
    r = await try_fill_by_patterns(page, [
        'input[name*="location"]', 'input[id*="location"]',
    ], profile["location"])
    if r: filled["location"] = True

    # LinkedIn
    r = await try_fill_by_patterns(page, [
        'input[name*="linkedin"]', 'input[id*="linkedin"]',
        'input[name*="LinkedIn"]',
    ], profile["linkedin"])
    if r: filled["linkedin"] = True

    # Website
    r = await try_fill_by_patterns(page, [
        'input[name*="website"]', 'input[id*="website"]',
        'input[name*="portfolio"]',
    ], profile["website"])
    if r: filled["website"] = True

    # GitHub
    r = await try_fill_by_patterns(page, [
        'input[name*="github"]', 'input[id*="github"]',
    ], profile["github"])
    if r: filled["github"] = True

    # Resume upload
    r = await safe_upload(page, 'input[type="file"]', profile["resume_path"])
    if r: filled["resume"] = True

    # Current company
    r = await try_fill_by_patterns(page, [
        'input[name*="current_company"]', 'input[id*="current_company"]',
        'input[name*="company"]',
    ], profile["current_company"])
    if r: filled["current_company"] = True

    # Work authorization — try select dropdowns
    auth_selectors = [
        'select[name*="authorized"]', 'select[id*="authorized"]',
        'select[name*="authorization"]', 'select[name*="work_auth"]',
    ]
    for sel in auth_selectors:
        if await safe_select(page, sel, profile["work_authorization"]):
            filled["work_auth"] = True
            break

    # Sponsorship
    sponsor_selectors = [
        'select[name*="sponsor"]', 'select[id*="sponsor"]',
    ]
    for sel in sponsor_selectors:
        if await safe_select(page, sel, profile["sponsorship_needed"]):
            filled["sponsorship"] = True
            break

    print(f"  ✅ Pre-filled {len(filled)} fields: {', '.join(filled.keys())}")
    return filled

# ============================================================
# ASHBY APPLICATION
# ============================================================

async def apply_ashby(page, profile, auto_submit=False):
    """Fill out an Ashby application form."""
    print("  🔵 Detected: Ashby")

    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    # Click Apply button if needed
    try:
        apply_btn = await page.wait_for_selector('button:has-text("Apply"), a:has-text("Apply")', timeout=3000)
        if apply_btn:
            await apply_btn.click()
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
    except:
        pass

    filled = {}

    # Ashby uses a more modern form structure
    # Name (sometimes single field, sometimes split)
    r = await try_fill_by_patterns(page, [
        'input[name="name"]', 'input[name*="Name"]',
        'input[placeholder*="name" i]', 'input[placeholder*="Name"]',
    ], f'{profile["first_name"]} {profile["last_name"]}')
    if r:
        filled["name"] = True
    else:
        await try_fill_by_patterns(page, [
            'input[name*="first"]', 'input[placeholder*="First"]',
        ], profile["first_name"])
        await try_fill_by_patterns(page, [
            'input[name*="last"]', 'input[placeholder*="Last"]',
        ], profile["last_name"])
        filled["name"] = True

    # Email
    r = await try_fill_by_patterns(page, [
        'input[name="email"]', 'input[type="email"]',
        'input[name*="email"]', 'input[placeholder*="email" i]',
    ], profile["email"])
    if r: filled["email"] = True

    # Phone
    r = await try_fill_by_patterns(page, [
        'input[name="phone"]', 'input[type="tel"]',
        'input[name*="phone"]', 'input[placeholder*="phone" i]',
    ], profile["phone"])
    if r: filled["phone"] = True

    # LinkedIn
    r = await try_fill_by_patterns(page, [
        'input[name*="linkedin" i]', 'input[placeholder*="linkedin" i]',
        'input[name*="LinkedIn"]',
    ], profile["linkedin"])
    if r: filled["linkedin"] = True

    # Current company
    r = await try_fill_by_patterns(page, [
        'input[name*="company" i]', 'input[placeholder*="company" i]',
        'input[name*="current" i]',
    ], profile["current_company"])
    if r: filled["current_company"] = True

    # Current title
    r = await try_fill_by_patterns(page, [
        'input[name*="title" i]', 'input[placeholder*="title" i]',
    ], profile["current_title"])
    if r: filled["current_title"] = True

    # Resume upload — Ashby sometimes uses drag-and-drop
    r = await safe_upload(page, 'input[type="file"]', profile["resume_path"])
    if r: filled["resume"] = True

    # Location / address
    r = await try_fill_by_patterns(page, [
        'input[name*="location" i]', 'input[placeholder*="location" i]',
        'input[name*="address" i]',
    ], profile["location"])
    if r: filled["location"] = True

    print(f"  ✅ Pre-filled {len(filled)} fields: {', '.join(filled.keys())}")
    return filled

# ============================================================
# LEVER APPLICATION
# ============================================================

async def apply_lever(page, profile, auto_submit=False):
    """Fill out a Lever application form."""
    print("  🟣 Detected: Lever")

    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    # Click Apply button
    try:
        apply_btn = await page.wait_for_selector('a.postings-btn:has-text("Apply"), a:has-text("Apply for this job")', timeout=3000)
        if apply_btn:
            await apply_btn.click()
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
    except:
        pass

    filled = {}

    # Lever uses specific form structure
    # Full name
    r = await try_fill_by_patterns(page, [
        'input[name="name"]', 'input.application-name',
        'input[placeholder*="name" i]',
    ], f'{profile["first_name"]} {profile["last_name"]}')
    if r: filled["name"] = True

    # Email
    r = await try_fill_by_patterns(page, [
        'input[name="email"]', 'input.application-email',
        'input[type="email"]',
    ], profile["email"])
    if r: filled["email"] = True

    # Phone
    r = await try_fill_by_patterns(page, [
        'input[name="phone"]', 'input.application-phone',
        'input[type="tel"]',
    ], profile["phone"])
    if r: filled["phone"] = True

    # Location
    r = await try_fill_by_patterns(page, [
        'input[name="location"]', 'input[name*="location"]',
    ], profile["location"])
    if r: filled["location"] = True

    # LinkedIn
    r = await try_fill_by_patterns(page, [
        'input[name*="urls[LinkedIn]"]', 'input[name*="linkedin" i]',
        'input[placeholder*="linkedin" i]',
    ], profile["linkedin"])
    if r: filled["linkedin"] = True

    # GitHub
    r = await try_fill_by_patterns(page, [
        'input[name*="urls[GitHub]"]', 'input[name*="github" i]',
        'input[placeholder*="github" i]',
    ], profile["github"])
    if r: filled["github"] = True

    # Website
    r = await try_fill_by_patterns(page, [
        'input[name*="urls[Portfolio]"]', 'input[name*="website" i]',
        'input[name*="urls[Other]"]',
    ], profile["website"])
    if r: filled["website"] = True

    # Current company
    r = await try_fill_by_patterns(page, [
        'input[name*="org"]', 'input[name*="company"]',
        'input[placeholder*="company" i]',
    ], profile["current_company"])
    if r: filled["current_company"] = True

    # Resume upload
    r = await safe_upload(page, 'input[type="file"][name*="resume"], input[type="file"]', profile["resume_path"])
    if r: filled["resume"] = True

    print(f"  ✅ Pre-filled {len(filled)} fields: {', '.join(filled.keys())}")
    return filled

# ============================================================
# GENERIC FALLBACK
# ============================================================

async def apply_generic(page, profile, auto_submit=False):
    """Best-effort fill for unknown ATS platforms."""
    print("  ⚪ Unknown ATS — attempting generic fill")

    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    filled = {}

    # Try common patterns
    field_attempts = [
        ("first_name", ['input[name*="first" i]', 'input[autocomplete="given-name"]'], profile["first_name"]),
        ("last_name", ['input[name*="last" i]', 'input[autocomplete="family-name"]'], profile["last_name"]),
        ("email", ['input[type="email"]', 'input[name*="email" i]'], profile["email"]),
        ("phone", ['input[type="tel"]', 'input[name*="phone" i]'], profile["phone"]),
        ("linkedin", ['input[name*="linkedin" i]'], profile["linkedin"]),
        ("location", ['input[name*="location" i]'], profile["location"]),
    ]

    for name, selectors, value in field_attempts:
        if await try_fill_by_patterns(page, selectors, value, timeout=1500):
            filled[name] = True

    # Resume
    if await safe_upload(page, 'input[type="file"]', profile["resume_path"]):
        filled["resume"] = True

    print(f"  ✅ Pre-filled {len(filled)} fields: {', '.join(filled.keys())}")
    return filled

# ============================================================
# APPLICATION LOG
# ============================================================

def log_application(url, ats, fields_filled, status):
    """Log application to JSON file."""
    log = []
    if Path(LOG_FILE).exists():
        with open(LOG_FILE) as f:
            log = json.load(f)

    log.append({
        "url": url,
        "ats": ats,
        "fields_filled": list(fields_filled.keys()),
        "status": status,
        "timestamp": datetime.now().isoformat(),
    })

    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)

# ============================================================
# MAIN APPLICATION FLOW
# ============================================================

async def apply_to_job(url, profile=PROFILE, auto_submit=False):
    """Main function to apply to a single job."""
    from playwright.async_api import async_playwright

    ats = detect_ats(url)
    print(f"\n{'='*60}")
    print(f"  Applying to: {url}")
    print(f"  ATS: {ats}")
    print(f"{'='*60}")

    async with async_playwright() as p:
        # Launch VISIBLE browser
        browser = await p.chromium.launch(
            headless=False,
            args=["--window-size=1400,900"],
        )
        context = await browser.new_context(
            viewport={"width": 1400, "height": 900},
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="networkidle", timeout=20000)
        except Exception as e:
            print(f"  ❌ Failed to load page: {e}")
            await browser.close()
            return

        # Route to correct ATS handler
        handlers = {
            "greenhouse": apply_greenhouse,
            "ashby": apply_ashby,
            "lever": apply_lever,
        }
        handler = handlers.get(ats, apply_generic)
        filled = await handler(page, profile, auto_submit)

        if auto_submit:
            # Auto-submit mode — find and click submit
            try:
                submit = await page.wait_for_selector(
                    'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply")',
                    timeout=5000
                )
                if submit:
                    await submit.click()
                    await asyncio.sleep(3)
                    print("  ✅ Application submitted automatically!")
                    log_application(url, ats, filled, "submitted")
            except:
                print("  ⚠️  Could not find submit button. Please submit manually.")
                log_application(url, ats, filled, "manual_submit_needed")
                input("\n  Press Enter when done...")
        else:
            # Manual review mode — pause for human
            log_application(url, ats, filled, "review_pending")
            print("\n" + "="*60)
            print("  👀 REVIEW THE APPLICATION IN THE BROWSER")
            print("  • Fill in any custom questions manually")
            print("  • Verify all pre-filled fields are correct")
            print("  • Submit when ready")
            print("="*60)
            print("\n  [Enter] = mark as done  |  [s] = skip  |  [q] = quit")
            choice = input("  > ").strip().lower()

            if choice == "q":
                await browser.close()
                return "quit"
            elif choice == "s":
                log_application(url, ats, filled, "skipped")
                print("  ⏭️  Skipped")
            else:
                log_application(url, ats, filled, "submitted")
                print("  ✅ Marked as done")

        await browser.close()
    return "done"

# ============================================================
# BATCH MODE
# ============================================================

async def batch_apply(urls_file, auto_submit=False):
    """Apply to multiple jobs from a file."""
    with open(urls_file) as f:
        urls = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    print(f"\n📋 Batch mode: {len(urls)} jobs to apply to")
    print(f"   Auto-submit: {'ON ⚡' if auto_submit else 'OFF (manual review)'}")
    print()

    for i, url in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}]", end="")
        result = await apply_to_job(url, auto_submit=auto_submit)
        if result == "quit":
            print("\n👋 Quitting batch mode.")
            break
        await asyncio.sleep(1)

    # Print summary
    if Path(LOG_FILE).exists():
        with open(LOG_FILE) as f:
            log = json.load(f)
        today = datetime.now().date().isoformat()
        today_apps = [l for l in log if l["timestamp"].startswith(today)]
        print(f"\n{'='*60}")
        print(f"  📊 Session Summary")
        print(f"  Total applications today: {len(today_apps)}")
        print(f"  Submitted: {sum(1 for l in today_apps if l['status']=='submitted')}")
        print(f"  Skipped: {sum(1 for l in today_apps if l['status']=='skipped')}")
        print(f"  Needs review: {sum(1 for l in today_apps if l['status']=='review_pending')}")
        print(f"{'='*60}")

# ============================================================
# CLI
# ============================================================

def main():
    print("""
╔══════════════════════════════════════════════════════════╗
║          AUTO-APPLY AGENT v1.0                           ║
║          FDE / AI Deployment Roles                       ║
╚══════════════════════════════════════════════════════════╝
    """)

    # Validate profile
    missing = [k for k in ["last_name", "email", "resume_path"] if not PROFILE[k]]
    if missing:
        print(f"⚠️  Please fill in your profile at the top of this script:")
        for m in missing:
            print(f"   - {m}")
        print()
        return

    if PROFILE["resume_path"] and not Path(PROFILE["resume_path"]).exists():
        print(f"⚠️  Resume not found: {PROFILE['resume_path']}")
        return

    if len(sys.argv) > 1:
        if sys.argv[1] == "--batch":
            urls_file = sys.argv[2] if len(sys.argv) > 2 else "urls.txt"
            auto = "--auto" in sys.argv
            asyncio.run(batch_apply(urls_file, auto_submit=auto))
        elif sys.argv[1] == "--help":
            print(__doc__)
        else:
            # Single URL mode
            asyncio.run(apply_to_job(sys.argv[1]))
    else:
        # Interactive mode
        print("Modes:")
        print("  1. Single URL — paste a job posting URL")
        print("  2. Batch — apply to all URLs in a file")
        print()
        while True:
            url = input("Paste job URL (or 'q' to quit): ").strip()
            if url.lower() in ("q", "quit", "exit"):
                break
            if url.startswith("http"):
                result = asyncio.run(apply_to_job(url))
                if result == "quit":
                    break
            else:
                print("  Invalid URL. Must start with http")

if __name__ == "__main__":
    main()
