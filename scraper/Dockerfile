# Lead-discovery engine. Same image runs from GitHub Actions today and from an
# always-on server later (checklist item 10) — only the scheduler changes.
#   docker build -t tagr-lead-engine scraper/
#   docker run --rm --env-file scraper/.env tagr-lead-engine --max-minutes 5
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt \
    # Chromium + its OS libraries, for the marketplace (Playwright) source.
    && playwright install --with-deps chromium

COPY src ./src
ENV PYTHONPATH=/app/src

# Never run a scraper as root.
RUN useradd --create-home scraper
USER scraper

ENTRYPOINT ["python", "-m", "leadengine.main"]
