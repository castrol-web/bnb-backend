import json
import pickle
import random
import os
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE_DIR, 'model.pkl'), 'rb') as f:
    pipeline = pickle.load(f)

with open(os.path.join(BASE_DIR, 'intent.json'), 'r') as f:
    intents = json.load(f)

CONFIDENCE_THRESHOLD = 0.6
WHATSAPP_LINK = "https://wa.me/+255657849224"

def get_response(user_input):
    X_vect = pipeline.named_steps['vectorizer'].transform([user_input])
    probs = pipeline.named_steps['classifier'].predict_proba(X_vect)[0]
    confidence = np.max(probs)
    predicted_tag = pipeline.named_steps['classifier'].classes_[np.argmax(probs)]

    if confidence < CONFIDENCE_THRESHOLD or predicted_tag == "contact_agent":
        return f"I'm forwarding you to our real agent on WhatsApp: {WHATSAPP_LINK}"

    for intent in intents['intents']:
        if intent['tag'] == predicted_tag:
            return random.choice(intent['responses'])

    for intent in intents['intents']:
        if intent['tag'] == "fallback":
            return random.choice(intent['responses'])

    return f"Please contact us via WhatsApp: {WHATSAPP_LINK}"

if __name__ == '__main__':
    print("🤖 Chatbot is ready! Type 'quit' to exit.")
    while True:
        inp = input("You: ")
        if inp.lower() == 'quit':
            break
        response = get_response(inp)
        print("Bot:", response)
