from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 422):
        self.code = code
        self.message = message
        self.status_code = status_code


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message},
    )


async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    fields = [".".join(str(part) for part in err["loc"][1:]) for err in exc.errors()]
    return JSONResponse(
        status_code=422,
        content={
            "code": "INVALID_INPUT",
            "message": "Dados inválidos.",
            "fields": fields,
        },
    )
