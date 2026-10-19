
from flask import Flask

from api.health import health_bp
from api.summary import summary_bp
from api.customers import customers_bp
from api.options import options_bp
from api.history import history_bp
from api.regions import regions_bp


app = Flask(__name__)

app.register_blueprint(health_bp)
app.register_blueprint(summary_bp)
app.register_blueprint(customers_bp)
app.register_blueprint(options_bp)
app.register_blueprint(history_bp)
app.register_blueprint(regions_bp)
