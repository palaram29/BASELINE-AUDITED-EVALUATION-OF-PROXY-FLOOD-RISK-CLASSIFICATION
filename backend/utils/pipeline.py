import subprocess
from backend.utils.logger import logger


def run_step(script_name):
    logger.info(f"Running {script_name}")

    result = subprocess.run(
        ["python", script_name],
        capture_output=True,
        text=True
    )

    success = result.returncode == 0

    if success:
        logger.info(f"{script_name} completed successfully")
    else:
        logger.error(f"{script_name} failed")

    return {
        "success": success,
        "stdout": result.stdout,
        "stderr": result.stderr
    }