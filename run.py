import uvicorn
from backend.app.core.config import settings

if __name__ == "__main__":
    print(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} on http://{settings.HOST}:{settings.PORT}")
    print(f"API v1 endpoints: http://{settings.HOST}:{settings.PORT}{settings.API_V1_STR}")
    print(f"Interactive Swagger Docs: http://localhost:{settings.PORT}/docs")
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
