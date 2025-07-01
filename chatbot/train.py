import json
import random
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
import numpy as np
import pickle

# Always work relative to the script's directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load intent file
with open(os.path.join(BASE_DIR, 'intent.json'), 'r') as file:
    data = json.load(file)

# Prepare training data
X = []  # patterns
y = []  # tags

for intent in data['intents']:
    for pattern in intent['patterns']:
        X.append(pattern)
        y.append(intent['tag'])

# Vectorize input text patterns
vectorizer = TfidfVectorizer()
X_vect = vectorizer.fit_transform(X)

# Train classifier (Logistic Regression)
clf = LogisticRegression()
clf.fit(X_vect, y)

# Save model and vectorizer
with open(os.path.join(BASE_DIR, 'model.pkl'), 'wb') as f:
    pickle.dump(clf, f)

with open(os.path.join(BASE_DIR, 'vectorizer.pkl'), 'wb') as f:
    pickle.dump(vectorizer, f)

print("Training completed and model saved.")