"""Run API: python -m nfl_sim.api"""

import uvicorn

from nfl_sim.config import settings


def main() -> None:
    uvicorn.run(
        "nfl_sim.api.app:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=False,
    )


if __name__ == "__main__":
    main()
