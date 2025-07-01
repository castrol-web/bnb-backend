from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import pickle
import random
import os
import numpy as np

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE_DIR, 'model.pkl'), 'rb') as f:
    model = pickle.load(f)

with open(os.path.join(BASE_DIR, 'vectorizer.pkl'), 'rb') as f:
    vectorizer = pickle.load(f)

with open(os.path.join(BASE_DIR, 'intent.json'), 'r') as f:
    intents = json.load(f)

def get_response_and_intent(user_input):
    X_vect = vectorizer.transform([user_input])
    probs = model.predict_proba(X_vect)[0]
    confidence = np.max(probs)
    predicted_tag = model.classes_[np.argmax(probs)]

    if confidence < 0.1:  # threshold for fallback
        predicted_tag = "fallback"

    for intent in intents['intents']:
        if intent['tag'] == predicted_tag:
            response = random.choice(intent['responses'])
            return response, predicted_tag

    # fallback default response if no match found (shouldn't happen)
    return "Sorry, I do not understand.", "fallback"


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_input = data.get('message', '')
    response_text, intent_tag = get_response_and_intent(user_input)

    # # Optional logging
    # with open(os.path.join(BASE_DIR, 'chat_logs.txt'), 'a') as log_file:
    #     log_file.write(f"User: {user_input}\nBot: {response_text}\nIntent: {intent_tag}\n\n")

    return jsonify({'response': response_text, 'intent': intent_tag})


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))  # default to 5000 if not set
    app.run(host="0.0.0.0", port=port)