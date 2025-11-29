# How to Run the Application

## Step 1: Open Two Terminal Windows

- **Terminal 1**: Open **Anaconda Prompt**
- **Terminal 2**: Open **Anaconda Prompt** (or any terminal)

---

## Step 2: Start Backend (Terminal 1)

Copy and paste these commands one by one:

```bash
cd C:\Users\rahul\Repos\llm-battle-arena
conda activate llm-battle-arena
python -m uvicorn main:app --reload --port 8000
```

**Wait until you see:** `Application startup complete.`

**Keep this terminal open!**

---

## Step 3: Start Frontend (Terminal 2)

Copy and paste these commands:

```bash
cd C:\Users\rahul\Repos\llm-battle-arena\frontend
npm install
npm run dev
```

**Note:** Only run `npm install` the first time. After that, just run `npm run dev`.

**Wait until you see:** `Local: http://localhost:5173`

---

## Step 4: Open Your Browser

Go to: **http://localhost:5173**

---

## Done! ✅

You should now see the LLM Battle Arena interface.

To stop the servers: Press `Ctrl+C` in each terminal window.

