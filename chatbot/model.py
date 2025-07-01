import json
import pickle
import random
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load trained model and vectorizer
with open(os.path.join(BASE_DIR, 'model.pkl'), 'rb') as f:
    model = pickle.load(f)

with open(os.path.join(BASE_DIR, 'vectorizer.pkl'), 'rb') as f:
    vectorizer = pickle.load(f)

# Load intents
with open(os.path.join(BASE_DIR, 'intent.json'), 'r') as f:
    intents = json.load(f)

def get_response(user_input):
    X_vect = vectorizer.transform([user_input])
    predicted_tag = model.predict(X_vect)[0]

    for intent in intents['intents']:
        if intent['tag'] == predicted_tag:
            return random.choice(intent['responses'])
    return "Sorry, I don't understand."

if __name__ == '__main__':
    print("Chatbot is ready! Type 'quit' to exit.")
    while True:
        inp = input("You: ")
        if inp.lower() == 'quit':
            break
        response = get_response(inp)
        print("Bot:", response)