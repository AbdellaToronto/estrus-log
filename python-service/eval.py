"""
Evaluate the BioCLIP + Linear Probe classification system.

This script:
1. Loads test images from dataset_split_cropped/test
2. Generates BioCLIP embeddings
3. Classifies using the trained Linear Probe (or k-NN as fallback)
4. Reports accuracy, classification report, and confusion matrix

Usage:
    python eval.py --test-dir ../dataset_split_cropped/test
    python eval.py --test-dir ../dataset_split_cropped/test --use-knn  # Use k-NN instead
"""

import os
import argparse
import asyncio
from typing import List, Optional
from PIL import Image
import torch
import numpy as np
from tqdm import tqdm
from dotenv import load_dotenv
from sklearn.metrics import confusion_matrix, classification_report, accuracy_score
import joblib

load_dotenv()

VALID_STAGES = ["PROESTRUS", "ESTRUS", "METESTRUS", "DIESTRUS"]
SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def get_embedding(model, processor, image_path: str) -> Optional[np.ndarray]:
    """Generate a BioCLIP embedding for an image."""
    try:
        image = Image.open(image_path).convert("RGB")
        image_tensor = processor(image).unsqueeze(0)
        with torch.no_grad():
            outputs = model.encode_image(image_tensor)
            features = outputs / outputs.norm(p=2, dim=-1, keepdim=True)
            embedding = features.squeeze().numpy()
        return embedding
    except Exception as e:
        print(f"Error processing image {image_path}: {e}")
        return None


def classify_with_linear_probe(embedding: np.ndarray, classifier_data: dict) -> str:
    """Classify an embedding using the Linear Probe."""
    classifier = classifier_data['classifier']
    label_encoder = classifier_data['label_encoder']
    
    embedding_2d = embedding.reshape(1, -1)
    prediction = classifier.predict(embedding_2d)[0]
    predicted_stage = label_encoder.inverse_transform([prediction])[0]
    
    return predicted_stage.upper()


async def classify_with_knn(embedding: List[float], supabase, k: int = 3) -> str:
    """Classify an embedding using k-NN via Supabase."""
    try:
        response = supabase.rpc("match_reference_images", {
            "query_embedding": embedding,
            "match_threshold": 0.0,
            "match_count": k
        }).execute()
        
        neighbors = response.data
        
        if not neighbors:
            return "UNKNOWN"
        
        # Voting
        votes = {}
        for n in neighbors:
            label = n['label'].upper()
            votes[label] = votes.get(label, 0) + 1
        
        # Simple majority
        return max(votes, key=votes.get)
        
    except Exception as e:
        print(f"k-NN RPC Error: {e}")
        return "ERROR"


def run_eval_linear_probe(test_dir: str, classifier_path: str = "classifier.pkl"):
    """Run evaluation using the Linear Probe classifier."""
    
    # Load classifier
    if not os.path.exists(classifier_path):
        print(f"Error: Classifier not found at {classifier_path}")
        print("Run train_classifier.py first to create the classifier.")
        return
    
    print(f"Loading classifier from {classifier_path}...")
    classifier_data = joblib.load(classifier_path)
    print(f"Classifier loaded. Classes: {classifier_data['classes']}")
    
    # Load BioCLIP model
    print("Loading BioCLIP model...")
    try:
        import open_clip
        model_name = 'hf-hub:imageomics/bioclip'
        model, _, preprocess = open_clip.create_model_and_transforms(model_name)
        model.eval()
    except Exception as e:
        print(f"Failed to load model: {e}")
        return

    y_true = []
    y_pred = []
    
    # Walk test directory
    subfolders = [d for d in os.listdir(test_dir) if os.path.isdir(os.path.join(test_dir, d))]
    
    print(f"\nRunning Evaluation on {test_dir} using Linear Probe...")
    
    for label in subfolders:
        if label.upper() not in VALID_STAGES:
            continue
        
        label_upper = label.upper()
        label_path = os.path.join(test_dir, label)
        files = [f for f in os.listdir(label_path) if os.path.splitext(f)[1].lower() in SUPPORTED_EXTS]
        
        for fname in tqdm(files, desc=f"Eval {label_upper}"):
            fpath = os.path.join(label_path, fname)
            
            # Get embedding
            embedding = get_embedding(model, preprocess, fpath)
            if embedding is None:
                continue
            
            # Classify with Linear Probe
            pred = classify_with_linear_probe(embedding, classifier_data)
            
            y_true.append(label_upper)
            y_pred.append(pred)
    
    # Report
    print_results(y_true, y_pred)


async def run_eval_knn(test_dir: str, url: str, key: str, k: int = 3):
    """Run evaluation using k-NN via Supabase (legacy method)."""
    from supabase import create_client, Client
    
    print(f"Connecting to Supabase at {url}...")
    supabase: Client = create_client(url, key)
    
    # Load BioCLIP model
    print("Loading BioCLIP model...")
    try:
        import open_clip
        model_name = 'hf-hub:imageomics/bioclip'
        model, _, preprocess = open_clip.create_model_and_transforms(model_name)
        model.eval()
    except Exception as e:
        print(f"Failed to load model: {e}")
        return

    y_true = []
    y_pred = []
    
    # Walk test directory
    subfolders = [d for d in os.listdir(test_dir) if os.path.isdir(os.path.join(test_dir, d))]
    
    print(f"\nRunning Evaluation on {test_dir} using k-NN (k={k})...")
    
    for label in subfolders:
        if label.upper() not in VALID_STAGES:
            continue
        
        label_upper = label.upper()
        label_path = os.path.join(test_dir, label)
        files = [f for f in os.listdir(label_path) if os.path.splitext(f)[1].lower() in SUPPORTED_EXTS]
        
        for fname in tqdm(files, desc=f"Eval {label_upper}"):
            fpath = os.path.join(label_path, fname)
            
            # Get embedding
            embedding = get_embedding(model, preprocess, fpath)
            if embedding is None:
                continue
            
            # Classify with k-NN
            pred = await classify_with_knn(embedding.tolist(), supabase, k)
            
            y_true.append(label_upper)
            y_pred.append(pred)
    
    # Report
    print_results(y_true, y_pred)


def print_results(y_true: List[str], y_pred: List[str]):
    """Print evaluation results."""
    if len(y_true) == 0:
        print("Error: No predictions made!")
        return
    
    print("\n" + "=" * 50)
    print("EVALUATION RESULTS")
    print("=" * 50)
    
    accuracy = accuracy_score(y_true, y_pred)
    print(f"\nAccuracy: {accuracy:.4f} ({accuracy*100:.1f}%)")
    
    print("\nClassification Report:")
    # Get all unique labels for proper ordering
    all_labels = sorted(list(set(y_true + y_pred)))
    print(classification_report(y_true, y_pred, labels=all_labels, target_names=all_labels, zero_division=0))
    
    print("Confusion Matrix:")
    cm = confusion_matrix(y_true, y_pred, labels=all_labels)
    
    # Print with labels
    print(f"\n{'':>12}", end="")
    for label in all_labels:
        print(f"{label[:8]:>10}", end="")
    print()
    
    for i, label in enumerate(all_labels):
        print(f"{label:>12}", end="")
        for j in range(len(all_labels)):
            print(f"{cm[i][j]:>10}", end="")
        print()
    
    print("\n" + "=" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate BioCLIP classification system")
    parser.add_argument("--test-dir", required=True, help="Path to test dataset (e.g., ../dataset_split_cropped/test)")
    parser.add_argument("--classifier", default="classifier.pkl", help="Path to classifier.pkl")
    parser.add_argument("--use-knn", action="store_true", help="Use k-NN instead of Linear Probe")
    parser.add_argument("--k", type=int, default=3, help="Number of neighbors for k-NN")
    args = parser.parse_args()

    if args.use_knn:
        # k-NN mode requires Supabase credentials
        url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            print("Error: k-NN mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.")
        else:
            asyncio.run(run_eval_knn(args.test_dir, url, key, args.k))
    else:
        # Linear Probe mode (default)
        run_eval_linear_probe(args.test_dir, args.classifier)
