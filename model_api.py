from flask import Flask, request, jsonify
from flask_cors import CORS
from joblib import load
import pandas as pd

app = Flask(__name__)
CORS(app)  # ✅ enable CORS

model = load("logistic_pipeline.pkl")
times = [10, 15, 20, 25]

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    df = pd.DataFrame([{
        "position": data["position"],
        "champion_A": data["champion_A"],
        "champion_B": data["champion_B"],
        **{f"csdiffat{t}_A": data.get(f"csdiffat{t}_A", 0) for t in times},
        **{f"golddiffat{t}_A": data.get(f"golddiffat{t}_A", 0) for t in times},
        **{f"xpdiffat{t}_A": data.get(f"xpdiffat{t}_A", 0) for t in times},
    }])
    prob = model.predict_proba(df)[0, 1]
    return jsonify({"probability": round(prob, 4)})

if __name__ == '__main__':
    app.run(port=5001)
