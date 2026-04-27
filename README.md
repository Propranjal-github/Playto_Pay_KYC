# PlaytoPay KYC Pipeline

A full-stack KYC (Know Your Customer) pipeline where **merchants** submit personal/business details and documents, and **reviewers** approve or reject them. Built for the Playto Founding Engineering Intern Challenge.

👉 **Live Demo:** [https://playto-pay-kyc.vercel.app](https://playto-pay-kyc.vercel.app)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 5.x + Django REST Framework |
| Frontend | React (Vite) + Tailwind CSS v4 |
| Database | PostgreSQL (Neon) |
| Auth | Token-based (DRF authtoken) |

## Features

- **Multi-step KYC form** — Personal details → Business details → Document upload → Review & Submit
- **Drag-and-Drop file uploads** — Modern component with visual drag states for document drop zones
- **Reviewer Round-Robin & Visibility** — Reviewers can see all submissions (satisfying base requirements), but new submissions are auto-assigned to specific reviewers (bonus requirement). The UI prominently highlights an `Assignee` column.
- **Strict Business Logic Validations** — The API strictly requires exactly 3 specific documents (PAN, Aadhaar, Bank Statement) and a `monthly_volume_usd` before allowing a KYC submission. Rejections and info-requests strictly require a written reason.
- **State machine enforcement** — All transitions validated in a single module (`kyc/state_machine.py`)
- **File upload validation** — Magic bytes detection (not just extension), 5 MB limit, PDF/JPG/PNG only
- **Reviewer dashboard** — Queue with SLA tracking, metrics (avg wait time, approval rate), approve/reject/request more info
- **SLA at-risk flag** — Dynamically computed (>24h in queue), no stored flag
- **Notification logging** — Every state transition creates a notification record
- **Role-based access** — Merchants strictly see only their own submissions; reviewers can access the entire reviewer dashboard.

## Quick Start

### Prerequisites

- Docker Desktop (Recommended for Backend)
- Node.js 18+ (For Frontend)
- OR Python 3.10+ (If running backend manually without Docker)

### Option 1: Backend via Docker (Recommended)

The easiest way to run the Django backend (which handles OS dependencies like `libmagic` automatically) is via Docker.

```bash
docker-compose up --build
```
Once running, open **http://localhost** in your browser.

*(Note: API requests are automatically reverse-proxied through Nginx on port 80 to avoid CORS issues).*

### Option 2: Manual Setup

#### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed test data (2 merchants + 1 reviewer)
python seed.py

# Run the server
python manage.py runserver 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies API to localhost:8000)
npm run dev
```

Open **http://localhost:5173** in your browser.

### Run Tests

```bash
cd backend
python manage.py test kyc.tests -v 2 --no-input
```

All 17 tests should pass (uses SQLite for testing).

## Test Credentials

| Username | Password | Role |
|----------|----------|------|
| `merchant_alice` | `alice123` | Merchant (1 draft submission) |
| `merchant_bob` | `bob12345` | Merchant (1 under_review submission with docs) |
| `reviewer_charlie` | `charlie123` | Reviewer |

## API Endpoints

All endpoints under `/api/v1/`.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register/` | Create account (username, password, role) |
| POST | `/auth/login/` | Get auth token |
| GET | `/auth/me/` | Current user info |

### Merchant Submissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/submissions/` | List own submissions |
| POST | `/submissions/` | Create new draft |
| GET | `/submissions/{id}/` | View submission detail |
| PATCH | `/submissions/{id}/` | Update draft fields |
| POST | `/submissions/{id}/submit/` | Submit for review |
| POST | `/submissions/{id}/documents/` | Upload document |

### Reviewer Queue
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/queue/` | List all submissions (oldest first) |
| GET | `/queue/{id}/` | View submission detail |
| GET | `/queue/metrics/` | Dashboard metrics |
| POST | `/queue/{id}/start_review/` | submitted → under_review |
| POST | `/queue/{id}/approve/` | under_review → approved |
| POST | `/queue/{id}/reject/` | under_review → rejected |
| POST | `/queue/{id}/request_info/` | under_review → more_info_requested |

## Project Structure

```
Playto_Pay_KYC/
├── backend/
│   ├── config/           # Django settings, URLs
│   ├── kyc/
│   │   ├── state_machine.py   # ★ Single source of truth for transitions
│   │   ├── models.py          # KYCSubmission, Document, Notification
│   │   ├── views.py           # API endpoints
│   │   ├── serializers.py     # DRF serializers
│   │   ├── permissions.py     # IsMerchant, IsReviewer
│   │   ├── validators.py      # File upload validation (magic bytes)
│   │   ├── exceptions.py      # Consistent error handler
│   │   └── tests.py           # 17 tests
│   ├── seed.py                # Seed script
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/             # Login, MerchantDashboard, MerchantKYC,
│   │   │                      # ReviewerDashboard, SubmissionDetail
│   │   ├── components/        # Navbar, StatusBadge
│   │   └── api/client.js      # Axios + token auth
│   └── vite.config.js
├── README.md
└── EXPLAINER.md
```
