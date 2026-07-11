import os
import sys
import time
import subprocess
from urllib.parse import urljoin

import requests
import schedule
from bs4 import BeautifulSoup

sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

from backend.utils.logger import logger

# DMC River Water Level Page
URL = "https://www.dmc.gov.lk/index.php?option=com_dmcreports&view=reports&Itemid=277&report_type_id=6&lang=en"

# Download folder
DOWNLOAD_FOLDER = "downloads"

# File to store downloaded PDFs
DOWNLOADED_LOG = "downloaded_files.txt"

# Create folder
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# Create log file if not exists
if not os.path.exists(DOWNLOADED_LOG):
    open(DOWNLOADED_LOG, "w").close()

def get_downloaded_files():
    with open(DOWNLOADED_LOG, "r") as file:
        return set(file.read().splitlines())

def save_downloaded_file(filename):
    with open(DOWNLOADED_LOG, "a") as file:
        file.write(filename + "\n")

def check_new_pdf():

    logger.info("Checking DMC website for new PDFs...")

    try:
        response = requests.get(URL)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        pdf_links = []

        for link in soup.find_all("a", href=True):

            href = link["href"]

            if ".pdf" in href.lower():

                full_url = urljoin(URL, href)
                pdf_links.append(full_url)

        if not pdf_links:
            logger.warning("No PDF links found.")
            return

        latest_pdf = pdf_links[0]

        pdf_name = latest_pdf.split("/")[-1]

        downloaded_files = get_downloaded_files()

        # Check if already downloaded
        if pdf_name in downloaded_files:
            logger.info("No new PDF found.")
            return

        logger.info(f"New PDF detected: {pdf_name}")

        # Download PDF
        pdf_response = requests.get(latest_pdf)

        save_path = os.path.join(DOWNLOAD_FOLDER, pdf_name)
        with open(save_path, "wb") as file:
            file.write(pdf_response.content)

        logger.info(f"Downloaded: {save_path}")

        # ==========================================
        # RUN EXTRACTION AUTOMATICALLY
        # ==========================================

        logger.info("Starting extraction...")

        result = subprocess.run(
            ["python", "backend/extract_river_data.py"],
            capture_output=True,
            text=True
        )

        # Run River Risk Engine
        risk_result = subprocess.run(
            ["python", "backend/river_risk_engine.py"],
            capture_output=True,
            text=True
        )

        print(risk_result.stdout)

        if risk_result.stderr:
            logger.error("Risk Engine Error:")
            logger.error(risk_result.stderr)

        print(result.stdout)

        if result.stderr:
            logger.error("Extraction Error:")
            logger.error(result.stderr)

        logger.info("Extraction completed.")

        # ==========================================
        # SAVE TO LOG
        # ==========================================

        save_downloaded_file(pdf_name)

    except Exception as e:
        logger.error(f"Error: {e}")

# Run every 60 minutes
schedule.every(60).minutes.do(check_new_pdf)

print("Realtime river monitoring started...")

# First run immediately
check_new_pdf()

# Keep running forever
while True:
    schedule.run_pending()
    time.sleep(1)