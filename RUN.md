# How to Run the App

## Open Two Terminal Windows

### Terminal 1 - Backend (Anaconda Prompt)

```bash
cd C:\Users\rahul\Repos\llm-battle-arena
conda activate llm-battle-arena
python -m uvicorn main:app --reload --port 8000
```

✅ Wait for: `Application startup complete.`

---

### Terminal 2 - Frontend (Any Terminal)

```bash
cd C:\Users\rahul\Repos\llm-battle-arena\frontend
npm install
npm run dev
```

✅ Wait for: `Local: http://localhost:5173`

**Note:** Only run `npm install` the first time!

---

## Open Browser

Go to: **http://localhost:5173**

---

## Stop Servers

Press `Ctrl+C` in each terminal to stop.

