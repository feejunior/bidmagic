from fastapi import FastAPI

app = FastAPI(title="BidMagic API")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
