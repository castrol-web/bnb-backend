import json
import random
import pickle
import numpy as np

# === Load intents and trained models ===
with open('intent.json', 'r') as file:
    intents = json.load(file)

with open('model.pkl', 'rb') as f:
    clf = pickle.load(f)

with open('vectorizer.pkl', 'rb') as f:
    vectorizer = pickle.load(f)

# === Chatbot Response Logic ===
def get_response(user_input):
    X_test = vectorizer.transform([user_input])
    probabilities = clf.predict_proba(X_test)[0]
    confidence = np.max(probabilities)
    predicted_tag = clf.classes_[np.argmax(probabilities)]

    # Debugging output (optional):
    # print(f"[DEBUG] Confidence: {confidence:.2f}, Predicted tag: {predicted_tag}")

    # 1. Forward to agent if low confidence or explicitly asking
    if confidence < 0.6 or predicted_tag == "contact_agent":
        return "I'm forwarding you to our real agent on WhatsApp: https://wa.me/+255657849224"

    # 2. Return response for matched tag
    for intent in intents['intents']:
        if intent['tag'] == predicted_tag:
            return random.choice(intent['responses'])

    # 3. Absolute fallback (should not reach here often)
    for intent in intents['intents']:
        if intent['tag'] == "fallback":
            return random.choice(intent['responses'])

    return "Sorry, I couldn't understand. Please try again or message us directly."

# === CLI Testing Loop ===
if __name__ == "__main__":
    print("🤖 BnB Chatbot is running. Type 'quit' to exit.")
    while True:
        user_input = input("You: ")
        if user_input.lower() == 'quit':
            break
        response = get_response(user_input)
        print("Bot:", response)
