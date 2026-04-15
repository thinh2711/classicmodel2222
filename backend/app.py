from flask import Flask
from flask_cors import CORS
from backend.config import Config

from backend.routes.stats   import stats_bp
from backend.routes.search  import search_bp
from backend.routes.pivot   import pivot_bp
from backend.routes.chatbot import chatbot_bp

def create_app():
    app = Flask(__name__, static_folder="../frontend", static_url_path="")
    app.config["SECRET_KEY"] = Config.SECRET_KEY
    CORS(app)

    # Register blueprints
    app.register_blueprint(stats_bp,   url_prefix="/api/stats")
    app.register_blueprint(search_bp,  url_prefix="/api/search")
    app.register_blueprint(pivot_bp,   url_prefix="/api/pivot")
    app.register_blueprint(chatbot_bp, url_prefix="/api/chatbot")

    # Serve frontend SPA
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve(path):
        return app.send_static_file("index.html")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
