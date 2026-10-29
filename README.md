# Meiora AI – Fake News & Brand Sentiment Detection System

An AI-powered evidentiary fact-checking and brand perception intelligence platform built according to the UI/UX design specifications.

---

## 🌟 Key Highlights & Philosophy

- **REAL DATA ONLY**: Strictly rejects mock news, fictional sources, synthetic trust scores, or dummy analysis results. Real user-provided articles and URLs are scraped using live web extractors and analyzed through Google Gemini AI.
- **Evidentiary Fact Checking**: Returns trust scores (0-100), confidence ratings, classifications (`Real`, `Fake`, `Misleading`, `Unverified`), key indicators, source credibility breakdown, claim-by-claim verification, and evidence citations.
- **Brand Sentiment Analysis**: Evaluates customer reviews and brand names, providing genuine sentiment distributions (positive, negative, neutral percentages), sentiment drivers, and consumer perception summaries.
- **AI Copilot**: Interactive assistant grounded in each specific analysis result to answer questions, explain nuance, and cite supporting or contradicting facts.
- **Downloadable PDF Reports**: Full verification reports with credibility metrics, evidence breakdown, and official citations generated via PDFKit.
- **Resilient Dual-Mode Data Architecture**: Connects directly to MongoDB when available; seamlessly falls back to local memory store when MongoDB is offline so development and demonstrations are never interrupted.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, React Router v7, Recharts, React Icons, CSS3 Glassmorphism |
| **Backend** | Node.js (v24), Express.js, REST API architecture |
| **Database** | MongoDB via Mongoose (with resilient in-memory fallback) |
| **AI Engine** | Google Gemini API (`@google/generative-ai` – `gemini-1.5-flash`) |
| **Web Extractor** | Axios + Cheerio (live HTML parsing, body extraction, metadata scraping) |
| **Reporting** | PDFKit (server-side streaming PDF generation) |
| **Auth & Security** | JWT (JSON Web Tokens), bcryptjs password hashing |

---

## 📁 Project Architecture

```
NOSQL/
├── client/                     # Frontend React + Vite application
│   ├── src/
│   │   ├── components/         # Common UI components (Navbar, Sidebar, AppLayout, Loader, EmptyState)
│   │   ├── context/            # AuthContext & AnalysisContext
│   │   ├── pages/              # 9 Full Pages:
│   │   │   ├── LandingPage.jsx       # Public landing page with features & hero
│   │   │   ├── AuthPage.jsx          # Login & Registration with JWT
│   │   │   ├── DashboardPage.jsx     # Overview, stats, charts & recent activity
│   │   │   ├── NewsDetectionPage.jsx # Text, URL scraping & File upload verification
│   │   │   ├── BrandSentimentPage.jsx# Brand name & review sentiment analysis
│   │   │   ├── ResultPage.jsx        # Trust ring, evidence, sources & AI Copilot
│   │   │   ├── HistoryPage.jsx       # Searchable, filterable history table
│   │   │   ├── ReportsPage.jsx       # Reports overview & PDF downloads
│   │   │   ├── ProfilePage.jsx       # User profile details and stats
│   │   │   └── SettingsPage.jsx      # Theme, language & notification controls
│   │   ├── services/           # Axios API client (interceptors, auth, endpoints)
│   │   ├── styles/             # Design tokens (variables.css, animations.css)
│   │   └── router.jsx          # Route definitions with ProtectedRoute
│   ├── .env                    # VITE_API_URL=http://localhost:5000/api
│   └── package.json
│
└── server/                     # Backend Node.js + Express REST API
    ├── src/
    │   ├── config/             # MongoDB connection with resilient fallback
    │   ├── controllers/        # Auth, Analysis, Copilot, and Reports controllers
    │   ├── middleware/         # JWT auth & optional auth middlewares
    │   ├── models/             # User & Analysis Mongoose models + dataStore adapter
    │   ├── routes/             # /api/auth, /api/analysis, /api/reports, /api/copilot
    │   ├── services/           # Gemini AI service & Web Scraper (Cheerio)
    │   └── server.js           # Express app entrypoint (CORS, JSON, routes)
    ├── .env                    # PORT, MONGODB_URI, JWT_SECRET, GEMINI_API_KEY
    └── package.json
```

---

## 🚀 Running the Application

### 1. Start the Backend Server

```bash
cd server
npm install
node src/server.js
```
The server will start at `http://localhost:5000`.
Health check: `http://localhost:5000/api/health`

### 2. Start the Frontend Client

```bash
cd client
npm install
npm run dev
```
The client will start at `http://localhost:5173`.

---

## 🔑 Configuring Google Gemini API

To enable live AI fact-checking, sentiment evaluation, and the interactive Copilot:
1. Open `server/.env`.
2. Insert your Google Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Restart or save the server. The server automatically detects the key.

*(Note: When no API key is provided, the system adheres to the REAL DATA ONLY policy and returns an informative notice instructing the user to configure the key, rather than fabricating mock data).*

---

## 📰 Configuring NewsAPI.org (Live Regional News with Photos)

To display live regional news articles accompanied by genuine publisher photos (`urlToImage`):
1. Sign in to your account at [NewsAPI.org](https://newsapi.org).
2. Copy your API key.
3. Open [`server/.env`](file:///c:/NOSQL/server/.env) and insert:
   ```env
   NEWS_API_KEY=your_news_api_key_here
   ```
4. Restart the backend server (`npm run dev` in `server/`). Meiora AI will seamlessly load live articles with verified images, with transparent Google News RSS fallback if the key is missing or quota is exhausted.

---

## 🌐 Configuring Google Sign-In (OAuth 2.0)

To enable "Continue with Google":
1. Open the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** with type **Web application**.
3. Under **Authorized JavaScript origins**, add:
   `http://localhost:5173`
4. Copy the generated **Client ID**.
5. Paste it in [`client/.env`](file:///c:/NOSQL/client/.env):
   ```env
   VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   ```
6. Restart `npm run dev`. Clicking "Continue with Google" will now launch the Google account selector!

---

## 📡 REST API Endpoints

### Authentication
- `POST /api/auth/register` – Register new user
- `POST /api/auth/login` – Authenticate user and return JWT
- `GET  /api/auth/me` – Retrieve current user profile (Protected)
- `PUT  /api/auth/profile` – Update profile details (Protected)

### Analysis
- `POST /api/analysis/news` – Analyze news via raw text, URL (with live web scraping), or file upload
- `POST /api/analysis/brand` – Analyze brand perception or review text
- `GET  /api/analysis/history` – Retrieve past analyses (filterable by type)
- `GET  /api/analysis/:id` – Retrieve single analysis details
- `DELETE /api/analysis/:id` – Delete an analysis record

### Reports & Copilot
- `GET  /api/reports` – List generated reports
- `GET  /api/reports/:id/download` – Stream downloadable PDF verification report
- `POST /api/copilot/ask` – AI Copilot interactive contextual Q&A
