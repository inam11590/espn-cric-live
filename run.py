import uvicorn
from app import config

if __name__ == "__main__":
    print(f"Starting Cricket Live Streaming & Score Service on http://{config.HOST}:{config.PORT}")
    print(f"Interactive API Docs available at http://localhost:{config.PORT}/docs")
    uvicorn.run("app.main:app", host=config.HOST, port=config.PORT, reload=config.DEBUG)
