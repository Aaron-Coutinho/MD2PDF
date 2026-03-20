# MD2PDF

Simple local web app to convert Markdown or plain text into a structured PDF with math support.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `.env.local` if needed:

```env
PUPPETEER_EXECUTABLE_PATH=
```

- `PUPPETEER_EXECUTABLE_PATH` is optional if Chrome/Edge is not auto-detected.
