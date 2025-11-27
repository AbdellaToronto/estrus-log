"""
Train a Linear Probe (Logistic Regression) classifier on BioCLIP embeddings.

This script:
1. Loads images from dataset_split_cropped/train
2. Generates BioCLIP embeddings for each image
3. Trains a Logistic Regression classifier
4. Saves the model to classifier.pkl

Usage:
    python train_classifier.py --train-dir ../dataset_split_cropped/train
"""

import os
import argparse
import numpy as np
from PIL import Image
import torch
import open_clip
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
import joblib
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()

# Valid estrus stages
VALID_STAGES = ["PROESTRUS", "ESTRUS", "METESTRUS", "DIESTRUS"]
SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def load_bioclip_model():
    """Load the BioCLIP model and preprocessor."""
    print("Loading BioCLIP model...")
    model_name = 'hf-hub:imageomics/bioclip'
    model, _, preprocess = open_clip.create_model_and_transforms(model_name)
    model.eval()
    print("BioCLIP model loaded successfully.")
    return model, preprocess


def get_embedding(model, preprocess, image_path: str) -> np.ndarray | None:
    """Generate a BioCLIP embedding for an image."""
    try:
        image = Image.open(image_path).convert("RGB")
        image_tensor = preprocess(image).unsqueeze(0)
        with torch.no_grad():
            outputs = model.encode_image(image_tensor)
            # Normalize the embedding
            features = outputs / outputs.norm(p=2, dim=-1, keepdim=True)
            embedding = features.squeeze().numpy()
        return embedding
    except Exception as e:
        print(f"Error processing image {image_path}: {e}")
        return None


def collect_training_data(train_dir: str, model, preprocess):
    """Collect embeddings and labels from the training directory."""
    embeddings = []
    labels = []
    
    # Get all class subdirectories
    subfolders = [d for d in os.listdir(train_dir) if os.path.isdir(os.path.join(train_dir, d))]
    
    for label in subfolders:
        # Only process valid stages
        if label.upper() not in VALID_STAGES:
            print(f"Skipping unknown label: {label}")
            continue
        
        label_path = os.path.join(train_dir, label)
        files = [f for f in os.listdir(label_path) if os.path.splitext(f)[1].lower() in SUPPORTED_EXTS]
        
        print(f"\nProcessing {label} ({len(files)} images)...")
        
        for fname in tqdm(files, desc=f"Embedding {label}"):
            fpath = os.path.join(label_path, fname)
            embedding = get_embedding(model, preprocess, fpath)
            
            if embedding is not None:
                embeddings.append(embedding)
                labels.append(label.upper())  # Normalize to uppercase
    
    return np.array(embeddings), np.array(labels)


def train_classifier(X: np.ndarray, y: np.ndarray):
    """Train a Logistic Regression classifier."""
    print(f"\nTraining Logistic Regression on {len(X)} samples...")
    
    # Encode labels
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    
    # Train classifier with stronger regularization to prevent overfitting
    # C=0.1 means stronger regularization (default is 1.0)
    classifier = LogisticRegression(
        max_iter=2000,
        class_weight='balanced',  # Handle class imbalance
        solver='lbfgs',
        C=0.1,  # Stronger regularization for small datasets
        random_state=42
    )
    
    classifier.fit(X, y_encoded)
    
    # Print training accuracy
    train_accuracy = classifier.score(X, y_encoded)
    print(f"Training accuracy: {train_accuracy:.4f}")
    
    return classifier, label_encoder


def main():
    parser = argparse.ArgumentParser(description="Train a Linear Probe classifier on BioCLIP embeddings")
    parser.add_argument("--train-dir", default="../dataset_split_cropped/train", 
                        help="Path to training dataset (e.g., ../dataset_split_cropped/train)")
    parser.add_argument("--output", default="classifier.pkl", 
                        help="Output path for the trained classifier")
    args = parser.parse_args()
    
    # Check if training directory exists
    if not os.path.exists(args.train_dir):
        print(f"Error: Training directory not found: {args.train_dir}")
        return
    
    # Load model
    model, preprocess = load_bioclip_model()
    
    # Collect training data
    X, y = collect_training_data(args.train_dir, model, preprocess)
    
    if len(X) == 0:
        print("Error: No training data found!")
        return
    
    print(f"\nCollected {len(X)} embeddings across {len(set(y))} classes")
    for label in VALID_STAGES:
        count = np.sum(y == label)
        print(f"  {label}: {count} samples")
    
    # Train classifier
    classifier, label_encoder = train_classifier(X, y)
    
    # Save both classifier and label encoder
    model_data = {
        'classifier': classifier,
        'label_encoder': label_encoder,
        'classes': label_encoder.classes_.tolist()
    }
    
    joblib.dump(model_data, args.output)
    print(f"\nClassifier saved to {args.output}")
    print(f"Classes: {model_data['classes']}")


if __name__ == "__main__":
    main()

