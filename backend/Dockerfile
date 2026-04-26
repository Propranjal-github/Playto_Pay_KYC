FROM python:3.10-slim

WORKDIR /app

# Install OS dependencies for python-magic and PostgreSQL
RUN apt-get update && apt-get install -y \
    libmagic1 \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and handle OS differences (Windows vs Linux magic bytes library)
COPY requirements.txt .
RUN sed -i 's/python-magic-bin/python-magic/g' requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

EXPOSE 8000

# Run migrations, seed the database with test data, and start gunicorn
CMD python manage.py migrate && python seed.py && gunicorn config.wsgi:application --bind 0.0.0.0:8000
