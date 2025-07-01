import json
import os
import pickle
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INTENT_FILE = os.path.join(BASE_DIR, 'intent.json')
MODEL_FILE = os.path.join(BASE_DIR, 'model.pkl')

# Load data
with open(INTENT_FILE, 'r', encoding='utf-8') as file:
    data = json.load(file)

X = []
y = []
for intent in data['intents']:
    for pattern in intent['patterns']:
        X.append(pattern)
        y.append(intent['tag'])

# Split for evaluation
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Build pipeline
pipeline = Pipeline([
    ('vectorizer', TfidfVectorizer(ngram_range=(1, 2), stop_words='english')),
    ('classifier', LogisticRegression(max_iter=1000))
])

pipeline.fit(X_train, y_train)

# Evaluate
y_pred = pipeline.predict(X_test)
print("\nClassification Report:")
print(classification_report(y_test, y_pred))

# Save full pipeline
with open(MODEL_FILE, 'wb') as f:
    pickle.dump(pipeline, f)

print("\n✅ Training complete. Model saved to model.pkl")
