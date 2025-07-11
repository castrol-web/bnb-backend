# from flask import Flask, request, jsonify
# from sentence_transformers import SentenceTransformer, util
# import json
# import random
# import os
# from dotenv import load_dotenv

# load_dotenv()

# app = Flask(__name__)

# BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# WHATSAPP_NUMBER = os.getenv("WHATSAPP_NUMBER", "+255657849224")
# CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", 0.60))

# # Load intents
# with open(os.path.join(BASE_DIR, 'intent.json'), 'r') as f:
#     intents = json.load(f)

# # Load embedding model
# model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

# # Encode all patterns
# intent_patterns = []
# for intent in intents['intents']:
#     for pattern in intent['patterns']:
#         intent_patterns.append({
#             "embedding": model.encode(pattern, convert_to_tensor=True),
#             "tag": intent['tag'],
#             "responses": intent['responses']
#         })

# # Matching logic
# def get_response_and_intent(user_input: str):
#     user_embedding = model.encode(user_input, convert_to_tensor=True)

#     best_score = -1
#     best_match = None

#     for pattern in intent_patterns:
#         score = util.cos_sim(user_embedding, pattern['embedding']).item()
#         if score > best_score:
#             best_score = score
#             best_match = pattern

#     if best_score < CONFIDENCE_THRESHOLD or best_match["tag"] == "contact_agent":
#         return (
#             "I couldn't quite understand that. Would you like to speak with our agent on WhatsApp?",
#             "fallback",
#             True
#         )

#     response = random.choice(best_match["responses"])
#     return response, best_match["tag"], False

# @app.route('/chat', methods=['POST'])
# def chat():
#     data = request.get_json()
#     user_input = data.get('message', '')

#     if not user_input.strip():
#         return jsonify({'response': "Please type something to continue.", 'intent': 'fallback', 'showWhatsapp': False})

#     response_text, intent_tag, show_whatsapp = get_response_and_intent(user_input)

#     return jsonify({
#         'response': response_text,
#         'intent': intent_tag,
#         'showWhatsapp': show_whatsapp,
#         'whatsappNumber': WHATSAPP_NUMBER if show_whatsapp else None
#     })

# if __name__ == '__main__':
#     port = int(os.environ.get("PORT", 5000))
#     app.run(host="0.0.0.0", port=port)

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import pickle
import json
import random
import numpy as np
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://bnabfrontend.onrender.com"])  # Allow only your frontend

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(BASE_DIR, 'model.pkl')
INTENT_FILE = os.path.join(BASE_DIR, 'intent.json')

# Load model and intents
with open(MODEL_FILE, 'rb') as f:
    pipeline = pickle.load(f)

with open(INTENT_FILE, 'r') as f:
    intents = json.load(f)

WHATSAPP_NUMBER = os.getenv("WHATSAPP_NUMBER", "+255657849224")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", 0.6))

def get_response(user_input):
    X = pipeline.named_steps['vectorizer'].transform([user_input])
    probs = pipeline.named_steps['classifier'].predict_proba(X)[0]
    confidence = np.max(probs)
    tag = pipeline.named_steps['classifier'].classes_[np.argmax(probs)]

    if confidence < CONFIDENCE_THRESHOLD or tag == "contact_agent":
        return (
            f"Let me connect you to a real agent on WhatsApp: {WHATSAPP_NUMBER}",
            "fallback",
            True
        )

    for intent in intents['intents']:
        if intent['tag'] == tag:
            return random.choice(intent['responses']), tag, False

    # Fallback
    for intent in intents['intents']:
        if intent['tag'] == "fallback":
            return random.choice(intent['responses']), "fallback", True

    return "Sorry, something went wrong.", "error", True

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = data.get("message", "")

    if not message.strip():
        return jsonify({'response': "Please type something.", 'intent': 'fallback', 'showWhatsapp': False})

    response_text, intent_tag, show_whatsapp = get_response(message)

    return jsonify({
        'response': response_text,
        'intent': intent_tag,
        'showWhatsapp': show_whatsapp,
        'whatsappNumber': WHATSAPP_NUMBER if show_whatsapp else None
    })

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

