import json
import random
import pickle

# Load intents and trained models
with open('intent.json', 'r') as file:
    intents = json.load(file)

with open('model.pkl', 'rb') as f:
    clf = pickle.load(f)

with open('vectorizer.pkl', 'rb') as f:
    vectorizer = pickle.load(f)

def get_response(user_input):
    X_test = vectorizer.transform([user_input])
    pred_tag = clf.predict(X_test)[0]

    for intent in intents['intents']:
        if intent['tag'] == pred_tag:
            return random.choice(intent['responses'])

    return "Sorry, I don't understand. Please contact us on WhatsApp: https://wa.me/+255657849224"

if __name__ == "__main__":
    print("Chatbot is running! Type 'quit' to stop.")
    while True:
        inp = input("You: ")
        if inp.lower() == 'quit':
            break
        response = get_response(inp)
        print("Bot:", response)