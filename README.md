# Adaptive Intelligence Learning Platform

A full-stack MERN EdTech application for learning **Java** and **Python** through a rule-based
adaptive quiz engine. Difficulty rises and falls with the learner's performance, every answer is
explained, mastery is tracked per topic, and topics unlock progressively along a learning path.

The adaptive engine (Elo rating, min-heap selection, prerequisite graph) is deterministic, configurable and fully offline. Gemini is optional and is used only to write tutor lessons and draft admin questions - it never grades answers, selects questions or changes difficulty.

---

## Features

**Learner**
- Landing page, registration, login, JWT-protected app shell
- Course selection between Java and Python, with progress stored separately per course
- Topic Explorer with 35 Java topics and 35 Python topics, searchable
- Topic detail pages with objectives, mastery, current difficulty and a cheat sheet
- Adaptive quiz: easy/medium/hard questions; a correct answer moves you up a level, a wrong one steps you back; questions you answered correctly never come back, questions you missed do
- Rich answer feedback: correctness, explanation, concept, tip, mastery delta, difficulty transition
- **Adaptive tutor**: after a wrong answer the app finds the likely misconception, explains it, gives a simple example, a mini practice and a reassessment; if you still do not get it, you get a simpler explanation (3 levels)
- Learning Path timeline with completed / current / locked states
- Progress page with per-topic mastery, attempts, accuracy and a chart
- Mistake Review of previously wrong answers, with practice links
- "Practise again" on any finished topic starts a fresh round of the test
- Resources page: cheat sheets, official docs and video references per topic
- Profile with stats, learning streak and course switching
- In-app notifications for mastery gains, topic completion and unlocks

**Admin**
- Admin dashboard with user / course / topic / question / attempt counts
- Full CRUD for courses, topics, questions and resources

**Cross-cutting**
- Loading, empty and error states on every data-driven page
- Friendly API error messages, global error handler, 401 auto-logout
- bcrypt password hashing, JWT auth, role-based admin authorization, rate limiting, CORS
- Responsive layout (mobile sidebar toggle), reduced-motion and focus-visible support

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 3, Axios, Recharts |
| Backend | Node.js, Express 4, REST API |
| Database | MongoDB with Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Tooling | dotenv, morgan, cors, express-rate-limit |

---

## Folder structure

```text
adaptive-intelligence-learning/
├── backend/
│   ├── config/            # db connection, adaptive engine tuning
│   ├── controllers/       # auth, course, topic, quiz, progress, resource, admin
│   ├── middleware/        # protect / adminOnly, error handler
│   ├── models/            # User, Course, Topic, Question, UserProgress,
│   │                      # QuizAttempt, Resource, Notification
│   ├── routes/            # /api route modules
│   ├── seed/
│   │   ├── data/          # courses, topics, 237 questions, 218 resources
│   │   └── seed.js        # validate + wipe + insert + demo users
│   ├── services/          # adaptiveEngine.js (pure), progressService.js, tutorService.js
│   ├── utils/             # ApiError, asyncHandler, validate, engineSelfTest
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/    # ui.jsx primitives, ProtectedRoute
│   │   ├── context/       # AuthContext, ToastContext
│   │   ├── data/          # static landing-page copy only
│   │   ├── hooks/         # useAsync
│   │   ├── layouts/       # AppLayout (sidebar + course switcher)
│   │   ├── pages/         # 14 learner pages + pages/admin (5 pages)
│   │   ├── services/api.js
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Requirements

- Node.js 18 or newer
- npm 9 or newer
- MongoDB 6 or newer running locally (or a MongoDB Atlas connection string)

---

## Environment variables

Copy `.env.example` to `backend/.env`:

```bash
cp .env.example backend/.env
```

```text
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/adaptive_learning
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173

# Adaptive engine tuning (all optional, defaults shown)
ADAPTIVE_PROMOTE_STREAK=1
ADAPTIVE_DEMOTE_STREAK=1
MASTERY_GAIN=10
MASTERY_PENALTY=5
MASTERY_THRESHOLD=80
MASTERY_MIN_ATTEMPTS=5
MASTERY_MIN_ACCURACY=0.7
MASTERY_REQUIRE_MEDIUM=true
MASTERY_MEDIUM_CORRECT=2
ADAPTIVE_RECENT_WINDOW=3
```

The server refuses to start without `JWT_SECRET`. For the frontend, `frontend/.env` is optional —
Vite proxies `/api` to `http://localhost:5000` in development.

---

## Database setup

Start MongoDB locally, for example:

```bash
mongod --dbpath /path/to/your/data
```

Then seed. Seeding **wipes** the courses, topics, questions, resources, users and progress
collections in the target database before inserting fresh content.

---

## Installation and running

### Backend

```bash
cd backend
npm install
npm run seed
npm run dev
```

API runs on `http://localhost:5000`.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:5173`.

### Other scripts

```bash
npm start            # backend, production mode
npm run test:engine  # backend, pure adaptive-engine self test (no DB needed)
npm run build        # frontend, production build
```

---

## Demo accounts

```text
Admin:    admin@example.com   / password123
Student:  student@example.com / password123
```

Passwords are hashed with bcrypt by the `User` model's pre-save hook — the seed never writes
plain text. The student account starts with partial Java progress so the dashboard, learning path
and progress pages have data on first login.

---

## API endpoints

**Auth**
```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me                 (auth)
PUT    /api/auth/profile            (auth)  update name / selected course
PUT    /api/auth/password           (auth)  change password
POST   /api/auth/logout             (auth)
```

**Courses & topics**
```text
GET    /api/courses
GET    /api/courses/:course
GET    /api/topics/:course
GET    /api/topics/:course/:topic
```

**Adaptive tutor**
```text
POST   /api/tutor/lesson            (auth)  { questionId, selectedAnswer, previousToken? }
POST   /api/tutor/check             (auth)  { sessionToken, step: practice|reassess, selectedAnswer }
GET    /api/tutor/stats             (auth)
```

**Quiz**
```text
GET    /api/quiz/question?course=java&topic=arrays   (auth)  next adaptive question
POST   /api/quiz/answer                              (auth)  submit + feedback
GET    /api/quiz/progress?course=java&topic=arrays   (auth)
GET    /api/quiz/mistakes?course=java                (auth)
POST   /api/quiz/restart   { course, topic }         (auth)  "Practise again": start a fresh round
```

**Progress**
```text
GET    /api/progress                (auth)
GET    /api/progress/dashboard      (auth)
GET    /api/progress/:course        (auth)  learning path + weak areas
GET    /api/notifications           (auth)
PUT    /api/notifications/read      (auth)
```

**Resources**
```text
GET    /api/resources/:course
GET    /api/resources/:course/:topic
```

**Admin** (auth + role `admin`)
```text
GET    /api/admin/stats
GET    /api/admin/users
GET    /api/admin/topics       GET /api/admin/questions       GET /api/admin/resources
POST   /api/admin/courses      PUT /api/admin/courses/:id
POST   /api/admin/topics       PUT /api/admin/topics/:id       DELETE /api/admin/topics/:id
POST   /api/admin/questions    PUT /api/admin/questions/:id    DELETE /api/admin/questions/:id
POST   /api/admin/resources    PUT /api/admin/resources/:id    DELETE /api/admin/resources/:id
```

Questions are serialised to learners through `toLearnerJSON()`, which strips `correctAnswer` and
`explanation` until the answer is submitted.

---

## Adaptive algorithm

State is kept per `(user, course, topic)` in `UserProgress`: `mastery`, `elo`, `difficulty`,
`consecutiveCorrect`, `consecutiveWrong`, `mediumCorrect`, `hardCorrect`, `attempts`,
`correctAnswers`, `wrongAnswers`, `recentQuestions` and `roundStartedAt`.

**1. Starting point.** Every new topic starts at `easy` with an Elo rating of 900.

**2. On a correct answer.** The Elo rating rises (`expected = 1/(1+10^((qElo-elo)/400))`,
`newElo = elo + K*(1-expected)`), mastery increases by `masteryGain` plus a level bonus
(`easy +0`, `medium +2`, `hard +5`), and after `ADAPTIVE_PROMOTE_STREAK` (default **1**) correct
answers in a row the learner **moves up one difficulty level immediately** (`easy -> medium -> hard`).
The rating is snapped to the new level's anchor so rating and level never disagree. `hard` is the ceiling.

**3. On a wrong answer.** The rating falls, mastery drops by `masteryPenalty`, and after
`ADAPTIVE_DEMOTE_STREAK` (default 1) wrong answers in a row the level steps down (`hard -> medium -> easy`).
`easy` is the floor: a learner who keeps missing easy questions stays on easy questions until they recover.

**4. Mastery.** Clamped to 0-100 at all times.

**5. Mastery gating (evidence, not luck).** A topic is only marked complete when *all* of these
hold: `mastery >= masteryThreshold` (80), `attempts >= minAttempts` (5),
`correct / attempts >= minAccuracy` (0.7), and `mediumCorrect + hardCorrect >= mediumCorrectRequired` (2).
One lucky answer can never complete a topic.

A topic is **also** completed when the learner has answered *every* question in it correctly. This
matters because correct answers are never repeated: a topic with 3-4 questions could otherwise never
reach the attempts/mastery gate, and the next topic would stay locked forever.

**6. Progression.** Completing a topic unlocks every topic whose prerequisites are now complete; the
learning path marks topics `completed`, `current` or `locked` accordingly, and a notification is written.

**7. Question selection (no repeats).** Attempt history comes from `QuizAttempt`, so it is exact and
survives across sessions.

- A question answered **correctly is never shown again**, and the server rejects a second
  submission for it (HTTP 409).
- A question answered **wrongly may come back** as a retry, flagged in the UI, but not within
  `recentWindow` (3) questions of the last time it was shown, unless nothing else is left.
- Otherwise the learner sees unseen questions. Every eligible question goes into a min-heap with
  priority = distance between its difficulty anchor and the learner's rating, plus small retry/recency
  penalties; the closest match is popped.
- When every question in the topic has been answered correctly there is nothing left to serve: the
  topic is completed and the learner is offered the next one, or **Practise again**.

**8. Practise again (new round).** Pressing *Practise again* calls `POST /api/quiz/restart`. This starts
a new **round** for that topic: `roundStartedAt` is set to now, the level and rating go back to the start,
and the streaks and recently-seen list are cleared. Nothing is deleted: the topic stays completed, mastery
and lifetime statistics are kept, and all earlier attempts remain in the database for Mistake Review.

Every threshold above is an environment variable, and the engine itself
(`backend/services/adaptiveEngine.js`) is a pure module with no database dependency - which is how
`npm run test:engine` exercises promotion, demotion, the easy floor, mastery clamping, the
evidence gate and unseen-question preference without MongoDB.

---

## Content

- 70 topics (35 Java, 35 Python) across fundamentals, control flow, core data structures,
  functions/methods, OOP, advanced basics and problem solving
- 237 questions (121 Java, 116 Python) mixing concept recall, code output, debugging, code
  completion, scenario choice and problem solving, each with explanation, concept and tip
- 218 resources (docs, practice sites and video references) plus a cheat sheet on every topic

A validation pass runs before seeding: it rejects unknown topic slugs, out-of-range answer
indexes, duplicate options and topics with fewer than three questions.

---

## Future improvements

- Optional LLM integration for generated hints and free-text answer grading
- In-browser code execution and auto-graded coding exercises
- Spaced repetition scheduling for previously mastered topics
- Cohort analytics and instructor dashboards
- Refresh tokens and social login

---

## Limitations

- The build environment had **no network access**, so `npm install` was never executed, no MongoDB
  instance was available, and the full end-to-end flow could not be run here. The adaptive engine's
  logic is covered by `npm run test:engine`, and all backend files pass `node --check`, but you
  should expect to run `npm install` and the seed yourself before first use.
- Video resources use YouTube **search URLs** for each topic rather than specific video IDs.
  Hardcoding video IDs risks dead or wrong links; search URLs always resolve to current material.
- Question coverage is small (most topics have 3-4 questions). Because correct answers never repeat, a
  topic ends once all of its questions are answered correctly, so a session on a topic is short. Add
  more questions in **Admin → Manage questions** (or the seed files) to lengthen it.
- Notifications are polled on page load rather than pushed over websockets.
- There is no password reset or email verification flow.

---

## Algorithms used in the adaptive engine

| Algorithm | Where | What it does |
|---|---|---|
| **Elo rating system** | `backend/services/adaptiveEngine.js` (`applyAnswer`, `eloToLevel`) | Each learner has a skill rating; each difficulty tier has a fixed anchor (easy 900, medium 1100, hard 1300). After every answer: `expected = 1/(1+10^((qElo-learnerElo)/400))`, `newElo = elo + K*(actual-expected)`. Difficulty tier is derived from the rating. |
| **Binary min-heap (priority queue)** | `backend/utils/minHeap.js`, used by `selectQuestion` | Every eligible question is pushed with priority = Elo distance + small retry/recency penalties; one `pop()` returns the best next question in O(log n). |
| **Prerequisite graph: Kahn's topological sort + BFS-style unlock** | `backend/services/topicGraph.js`, used by `progressService.buildLearningPath` | Topics form a DAG via `prerequisites`. A topic unlocks only when all its prerequisites are completed. Cycles are detected and fail open. |

Tuning lives in `backend/config/adaptive.config.js` (`elo`, `heap`). Run `npm run test:engine` in `backend/` to verify.

Note: re-run `npm run seed` so topics receive their `prerequisites`. Existing progress rows default to Elo 900.

---

## Gemini AI question generation

Gemini is used to **generate question drafts** (admin) and **write tutor lessons** (see below). It never grades answers, picks questions or changes difficulty; the Elo / heap / graph engine still does all of that.

**Setup**
1. Create a key at https://aistudio.google.com/apikey
2. Open `backend/.env` and add:
   ```
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```
3. Restart the backend (`npm run dev` in `backend/`). Requires Node 18+.

**Use it:** sign in as admin > Manage questions > *Generate questions with Gemini*. Pick a course, topic, difficulty, style and count, review the drafts, and save the ones you approve. Saved questions are tagged *AI-generated*.

**How it works:** `POST /api/admin/questions/generate` builds a prompt from the topic's name, objectives, notes and common mistakes, lists existing questions so they are not repeated, and asks Gemini for JSON in a fixed schema. The server then validates every draft with the same rules as the manual form, drops duplicates, and shuffles option order. `POST /api/admin/questions/generated` saves the approved drafts.

The key stays on the server (sent in a request header, never to the browser). Run `npm run test:gemini` in `backend/` to check the integration without a network or key.

---

## Adaptive tutor (wrong answer -> understanding)

```text
Wrong answer -> Misconception detection -> Explanation -> Simple example
   -> Mini practice -> Reassessment -> Understood?
                                        YES: continue the quiz
                                        NO : simpler explanation (level 2, then 3), then back to the topic notes
```

**Use it:** answer a quiz question wrongly. A tutor panel opens under the feedback; work through it or press *Skip and continue*.

**How it works:** `POST /api/tutor/lesson` sends Gemini the question, the correct option and the option the learner chose. Gemini returns the misconception, an explanation, a new example, a mini practice question and a reassessment question (JSON schema, validated by the server). `POST /api/tutor/check` grades each step. Level 2 and 3 lessons are requested with the previous session token, so the model knows the earlier explanation did not work and changes its approach.

**Safety and design notes**
- Gemini never grades. Answer keys are sealed in a signed, user-bound session token (2 h), so the browser never sees them.
- Tutor sessions do not change mastery, Elo or difficulty; the adaptive engine still owns those. Each session is stored in `TutorSession` (misconception, level, understood).
- If Gemini is not configured or returns unusable output, a fallback lesson is built from the question's own explanation and tip, and the reassessment is another question from the same topic. The loop still works with no API key.
- Lessons are rate-limited to 60 per hour per IP. Run `npm run test:tutor` in `backend/` to check the loop without a network or database.
