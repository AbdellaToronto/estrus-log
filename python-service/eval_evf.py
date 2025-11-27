"""
Evaluate EVF-SAM2 + BioCLIP + k-NN pipeline.

This script:
1. Loads raw test images (from dataset_split_cropped/test filenames, but reads from dataset_raw)
2. Crops with EVF-SAM2 using "mouse genitalia" prompt
3. Generates BioCLIP embeddings
4. Classifies using k-NN via Supabase
5. Reports accuracy vs the OWLv2 baseline (53.3%)
"""

import os
import asyncio
from typing import List, Optional
from PIL import Image
import torch
import numpy as np
from tqdm import tqdm
from dotenv import load_dotenv
from sklearn.metrics import confusion_matrix, classification_report, accuracy_score
import open_clip
from supabase import create_client, Client

# Import EVF wrapper
from evf_sam_wrapper import segment_with_evf_sam2, load_evf_sam2

load_dotenv()

# Configuration
TEST_SPLIT_DIR = "../dataset_split_cropped/test"
RAW_DATA_DIR = "../dataset_raw"
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase credentials not found")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# BioCLIP model
bioclip_model = None
bioclip_preprocess = None


def load_bioclip():
    global bioclip_model, bioclip_preprocess
    print("Loading BioCLIP model...")
    model_name = 'hf-hub:imageomics/bioclip'
    bioclip_model, _, bioclip_preprocess = open_clip.create_model_and_transforms(model_name)
    bioclip_model.eval()
    print("BioCLIP loaded.")


def get_embedding(image: Image.Image) -> np.ndarray:
    image_tensor = bioclip_preprocess(image).unsqueeze(0)
    with torch.no_grad():
        outputs = bioclip_model.encode_image(image_tensor)
        features = outputs / outputs.norm(p=2, dim=-1, keepdim=True)
        return features.squeeze().numpy()


def classify_knn(embedding: List[float], k: int = 3) -> str:
    try:
        response = supabase.rpc("match_reference_images", {
            "query_embedding": embedding,
            "match_threshold": 0.0,
            "match_count": k
        }).execute()
        
        neighbors = response.data
        if not neighbors:
            return "UNKNOWN"
        
        votes = {}
        for n in neighbors:
            label = n['label'].upper()
            votes[label] = votes.get(label, 0) + 1
            
        return max(votes, key=votes.get)
    except Exception as e:
        print(f"RPC Error: {e}")
        return "ERROR"


def main():
    # Load models
    load_evf_sam2(precision="fp32")
    load_bioclip()
    
    y_true = []
    y_pred = []
    
    print(f"\n{'='*60}")
    print("EVF-SAM2 + BioCLIP + k-NN Evaluation")
    print(f"{'='*60}")
    print(f"Test images from: {TEST_SPLIT_DIR}")
    print(f"Raw images from: {RAW_DATA_DIR}")
    print(f"Prompt: 'mouse genitalia'")
    print(f"{'='*60}\n")
    
    processed_count = 0
    evf_success_count = 0
    
    # Get test file list from cropped split
    for label in os.listdir(TEST_SPLIT_DIR):
        label_dir = os.path.join(TEST_SPLIT_DIR, label)
        if not os.path.isdir(label_dir) or label == "UNKNOWN":
            continue
        
        files = [f for f in os.listdir(label_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        
        print(f"Processing {label} ({len(files)} images)...")
        
        for fname in tqdm(files, desc=label):
            # Find RAW image
            raw_path = os.path.join(RAW_DATA_DIR, label, fname)
            if not os.path.exists(raw_path):
                continue
            
            processed_count += 1
            
            # Load raw image
            try:
                image = Image.open(raw_path).convert("RGB")
            except Exception as e:
                print(f"Error opening {raw_path}: {e}")
                continue
            
            # Crop with EVF-SAM2
            cropped = segment_with_evf_sam2(image, "mouse genitalia")
            if cropped:
                evf_success_count += 1
                image = cropped
            
            # Generate embedding
            embedding = get_embedding(image)
            
            # Classify with k-NN
            pred = classify_knn(embedding.tolist(), k=3)
            
            y_true.append(label.upper())
            y_pred.append(pred)
    
    # Results
    print(f"\n{'='*60}")
    print("RESULTS")
    print(f"{'='*60}")
    print(f"Total Images: {processed_count}")
    print(f"EVF-SAM2 Crop Success: {evf_success_count}/{processed_count} ({evf_success_count/processed_count*100:.1f}%)")
    
    accuracy = accuracy_score(y_true, y_pred)
    print(f"\n🎯 Accuracy: {accuracy:.4f} ({accuracy*100:.1f}%)")
    print(f"   Baseline (OWLv2): 53.3%")
    print(f"   Improvement: {(accuracy - 0.533)*100:+.1f}%")
    
    print("\nClassification Report:")
    all_labels = sorted(list(set(y_true + y_pred)))
    print(classification_report(y_true, y_pred, labels=all_labels, target_names=all_labels, zero_division=0))
    
    print("Confusion Matrix:")
    cm = confusion_matrix(y_true, y_pred, labels=all_labels)
    print(f"\n{'':>12}", end="")
    for label in all_labels:
        print(f"{label[:8]:>10}", end="")
    print()
    for i, label in enumerate(all_labels):
        print(f"{label:>12}", end="")
        for j in range(len(all_labels)):
            print(f"{cm[i][j]:>10}", end="")
        print()
    
    print(f"\n{'='*60}")


if __name__ == "__main__":
    main()




