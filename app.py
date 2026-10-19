"""Flask application: REST API + dashboard.

Run with:  python app.py   ->  http://127.0.0.1:5000
"""
from flask import Flask, jsonify, request, send_from_directory

import service
from data_loader import DataValidationError

app = Flask(__name__, static_folder="static", static_url_path="/static")


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/summary")
def summary():
    return jsonify(service.get_summary())


@app.route("/api/customers")
def customers():
    data = service.get_customers(
        city=request.args.get("city"),
        severity=request.args.get("severity"),
        profile=request.args.get("profile"),
        search=request.args.get("search"),
        sort=request.args.get("sort"),
    )
    return jsonify(data)


@app.route("/api/options")
def options():
    return jsonify(service.get_options())


@app.errorhandler(DataValidationError)
def handle_data_error(err):
    return jsonify({"error": str(err)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
