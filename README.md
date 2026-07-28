# RxGuardian AI

RxGuardian AI is an AI-powered prescription extraction, verification, safety analysis, and clinical risk scoring system built for pharmacists and healthcare providers.

## Architecture

```
RxGuardian-AI/
├── client/                        # React Frontend (React 19, Vite, Tailwind CSS, Lucide Icons)
│   ├── src/
│   │   ├── components/            # Dashboard, OCR, ReviewTable, Alerts, Common
│   │   ├── pages/                 # Login, Signup, Dashboard, NewAnalysis, History, About
│   │   ├── services/              # API Axios instance, Auth, Analysis API helpers
│   │   ├── context/               # AuthContext
│   │   ├── types/                 # Shared TypeScript interfaces
│   │   └── App.tsx
│   └── package.json
├── server/                        # Express Backend
│   ├── routes/                    # Auth, Analysis, History
│   ├── middleware/                # Auth, Upload (Multer)
│   ├── database/                  # SQLite database (database.db, schema.sql)
│   ├── services/                  # Extractor (EasyOCR), Parser, RxNorm, OpenFDA, Safety, RxScore
│   └── server.ts                  # Express full-stack entry point
├── ocr/                           # Python EasyOCR reader script
│   ├── easyocr_reader.py
│   └── requirements.txt
├── uploads/                       # Permanent upload directory
├── temp/                          # Temporary image processing directory
├── .env                           # Environment configuration
└── README.md
```

## Key Clinical Features

- **EasyOCR Extraction**: Local image OCR text line extraction with 15-second process timeout and race-free temp file lifecycle.
- **RxNorm Drug Resolution**: Fuzzy-matches candidate drug lines against NIH RxNorm `approximateTerm.json` and caches RxCUIs in SQLite.
- **OpenFDA Clinical Labeling**: Retrieves official FDA Boxed Cautions, drug interaction texts, and contraindications.
- **RxScore Risk Engine**: Computes objective clinical risk score (0–100) and categorizes into Green Safe (80-100), Yellow Needs Review (50-79), and Red High Risk (<50) bands.
- **Empty State Guarantee**: Pharmacist Review table initializes completely empty until an image is uploaded or a medicine is manually added.
- **Strict Null Safety**: No hardcoded default strings or fallback fake drug warnings.
