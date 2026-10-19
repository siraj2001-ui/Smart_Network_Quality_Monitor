
from pathlib import Path

from flask import Flask, send_from_directory

from api.health import health_bp
from api.summary import summary_bp
from api.customers import customers_bp
from api.options import options_bp
from api.history import history_bp
from api.regions import regions_bp


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path=""
)

app.register_blueprint(health_bp)
app.register_blueprint(summary_bp)
app.register_blueprint(customers_bp)
app.register_blueprint(options_bp)
app.register_blueprint(history_bp)
app.register_blueprint(regions_bp)


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
