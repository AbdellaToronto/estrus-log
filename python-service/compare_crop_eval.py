#!/usr/bin/env python3
"""
Compare OWLv2 vs SAM3 cropping for classification accuracy.

Runs both approaches on the same test set and compares results.
"""

import os
import base64
import io
import requests
from pathlib import Path
from collections import Counter

import numpy as np
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report


# Modal endpoints
SAM3_ENDPOINT = "https://abdellaalioncan--estrus-pipeline-segment-endpoint.modal.run"
BIOCLIP_ENDPOINT = "https://abdellaalioncan--estrus-pipeline-embed-endpoint.modal.run"


def load_dataset(base_dir: str, split: str):
    """Load images from dataset."""
    images = []
    split_path = Path(base_dir) / split
    raw_path = Path(base_dir).parent / "dataset_raw"
    
    for label_dir in split_path.iterdir():
        if not label_dir.is_dir():
            continue
        label = label_dir.name.upper()
        if label == "UNKNOWN":
            continue
        
        for img_file in label_dir.glob("*.jpg"):
            raw_file = raw_path / label / img_file.name
            if raw_file.exists():
                images.append((str(raw_file), label))
            else:
                images.append((str(img_file), label))
    
    return images


def crop_with_sam3(image_bytes: bytes, prompt: str = "mouse body") -> bytes:
    """Crop image using SAM3 on Modal."""
    try:
        resp = requests.post(
            SAM3_ENDPOINT,
            json={
                "image": base64.b64encode(image_bytes).decode(),
                "prompt": prompt,
            },
            timeout=180,
        )
        if resp.status_code == 200:
            return base64.b64decode(resp.json()["image"])
    except Exception as e:
        print(f"SAM3 error: {e}")
    return image_bytes  # Return original on failure


def crop_with_owlv2(image_bytes: bytes) -> bytes:
    """Crop image using OWLv2 (local)."""
    try:
        # Import OWLv2 locally
        import torch
        from transformers import Owlv2Processor, Owlv2ForObjectDetection
        
        # Load model (cached after first load)
        if not hasattr(crop_with_owlv2, "model"):
            print("Loading OWLv2 model...")
            crop_with_owlv2.processor = Owlv2Processor.from_pretrained("google/owlv2-base-patch16-ensemble")
            crop_with_owlv2.model = Owlv2ForObjectDetection.from_pretrained("google/owlv2-base-patch16-ensemble")
            print("OWLv2 loaded!")
        
        processor = crop_with_owlv2.processor
        model = crop_with_owlv2.model
        
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Run detection
        texts = [["mouse genitalia", "vulva", "mouse rear"]]
        inputs = processor(text=texts, images=image, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model(**inputs)
        
        # Get best detection
        target_sizes = torch.tensor([image.size[::-1]])
        results = processor.post_process_object_detection(
            outputs, target_sizes=target_sizes, threshold=0.1
        )[0]
        
        if len(results["boxes"]) > 0:
            # Get highest scoring box
            best_idx = results["scores"].argmax().item()
            box = results["boxes"][best_idx].tolist()
            
            # Crop with padding
            x1, y1, x2, y2 = box
            pad = 20
            x1 = max(0, int(x1) - pad)
            y1 = max(0, int(y1) - pad)
            x2 = min(image.width, int(x2) + pad)
            y2 = min(image.height, int(y2) + pad)
            
            cropped = image.crop((x1, y1, x2, y2))
            
            buf = io.BytesIO()
            cropped.save(buf, format="JPEG", quality=95)
            return buf.getvalue()
    
    except Exception as e:
        print(f"OWLv2 error: {e}")
    
    return image_bytes  # Return original on failure


def embed_with_bioclip(image_bytes: bytes) -> list:
    """Get BioCLIP embedding from Modal."""
    try:
        resp = requests.post(
            BIOCLIP_ENDPOINT,
            json={"image": base64.b64encode(image_bytes).decode()},
            timeout=120,
        )
        if resp.status_code == 200:
            return resp.json()["embedding"]
    except Exception as e:
        print(f"BioCLIP error: {e}")
    return None


def embed_with_bioclip_local(image_bytes: bytes) -> list:
    """Get BioCLIP embedding locally."""
    try:
        import torch
        import open_clip
        
        if not hasattr(embed_with_bioclip_local, "model"):
            print("Loading BioCLIP locally...")
            model, _, preprocess = open_clip.create_model_and_transforms('hf-hub:imageomics/bioclip')
            model.eval()
            embed_with_bioclip_local.model = model
            embed_with_bioclip_local.preprocess = preprocess
            print("BioCLIP loaded!")
        
        model = embed_with_bioclip_local.model
        preprocess = embed_with_bioclip_local.preprocess
        
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_tensor = preprocess(image).unsqueeze(0)
        
        with torch.no_grad():
            features = model.encode_image(image_tensor)
            features = features / features.norm(p=2, dim=-1, keepdim=True)
        
        return features.squeeze().tolist()
    
    except Exception as e:
        print(f"Local BioCLIP error: {e}")
    return None


def run_eval(train_data, test_data, crop_fn, crop_name: str, use_local_bioclip: bool = True):
    """Run evaluation with a specific cropping function."""
    print(f"\n{'='*60}")
    print(f"Evaluating: {crop_name}")
    print(f"{'='*60}")
    
    embed_fn = embed_with_bioclip_local if use_local_bioclip else embed_with_bioclip
    
    # Process training data
    print(f"Processing {len(train_data)} training images...")
    train_embeddings = []
    train_labels = []
    
    for i, (img_path, label) in enumerate(train_data):
        if i % 20 == 0:
            print(f"  Train: {i}/{len(train_data)}")
        
        with open(img_path, "rb") as f:
            img_bytes = f.read()
        
        cropped = crop_fn(img_bytes)
        emb = embed_fn(cropped)
        
        if emb is not None:
            train_embeddings.append(emb)
            train_labels.append(label)
    
    # Train classifier
    print(f"Training on {len(train_embeddings)} samples...")
    X_train = np.array(train_embeddings)
    le = LabelEncoder()
    y_train = le.fit_transform(train_labels)
    
    clf = LogisticRegression(
        random_state=42,
        solver='liblinear',
        multi_class='ovr',
        class_weight='balanced',
        C=0.1,
        max_iter=1000,
    )
    clf.fit(X_train, y_train)
    
    train_acc = clf.score(X_train, y_train)
    print(f"  Train accuracy: {train_acc:.4f}")
    
    # Process test data
    print(f"Processing {len(test_data)} test images...")
    test_embeddings = []
    test_labels = []
    
    for i, (img_path, label) in enumerate(test_data):
        if i % 10 == 0:
            print(f"  Test: {i}/{len(test_data)}")
        
        with open(img_path, "rb") as f:
            img_bytes = f.read()
        
        cropped = crop_fn(img_bytes)
        emb = embed_fn(cropped)
        
        if emb is not None:
            test_embeddings.append(emb)
            test_labels.append(label)
    
    # Evaluate
    X_test = np.array(test_embeddings)
    y_test = le.transform(test_labels)
    
    y_pred = clf.predict(X_test)
    test_acc = accuracy_score(y_test, y_pred)
    
    pred_labels = le.inverse_transform(y_pred)
    
    print(f"\n🎯 {crop_name} Test Accuracy: {test_acc:.4f} ({test_acc*100:.1f}%)")
    print(classification_report(test_labels, pred_labels))
    
    return {
        "name": crop_name,
        "train_accuracy": train_acc,
        "test_accuracy": test_acc,
        "n_train": len(train_embeddings),
        "n_test": len(test_embeddings),
    }


def main():
    print("=" * 60)
    print("OWLv2 vs SAM3 Cropping Comparison")
    print("=" * 60)
    
    # Load data
    base_dir = "../dataset_split_cropped"
    
    print("\n📂 Loading data...")
    train_data = load_dataset(base_dir, "train")
    test_data = load_dataset(base_dir, "test")
    
    print(f"   Train: {len(train_data)} images")
    print(f"   Test: {len(test_data)} images")
    
    # Show distribution
    train_dist = Counter(label for _, label in train_data)
    test_dist = Counter(label for _, label in test_data)
    print(f"\n   Train distribution: {dict(train_dist)}")
    print(f"   Test distribution: {dict(test_dist)}")
    
    results = []
    
    # 1. No cropping (raw images)
    print("\n" + "="*60)
    print("Testing: No cropping (raw images)")
    raw_result = run_eval(
        train_data, test_data,
        crop_fn=lambda x: x,  # No cropping
        crop_name="No Crop (Raw)",
        use_local_bioclip=True,
    )
    results.append(raw_result)
    
    # 2. OWLv2 cropping
    print("\n" + "="*60)
    print("Testing: OWLv2 cropping")
    owlv2_result = run_eval(
        train_data, test_data,
        crop_fn=crop_with_owlv2,
        crop_name="OWLv2 Crop",
        use_local_bioclip=True,
    )
    results.append(owlv2_result)
    
    # 3. SAM3 "mouse body" cropping
    print("\n" + "="*60)
    print("Testing: SAM3 'mouse body' cropping")
    sam3_result = run_eval(
        train_data, test_data,
        crop_fn=lambda x: crop_with_sam3(x, "mouse body"),
        crop_name="SAM3 'mouse body'",
        use_local_bioclip=True,
    )
    results.append(sam3_result)
    
    # Summary
    print("\n" + "=" * 60)
    print("FINAL COMPARISON")
    print("=" * 60)
    
    for r in results:
        print(f"  {r['name']:25s}: {r['test_accuracy']*100:5.1f}% (train: {r['train_accuracy']*100:.1f}%)")
    
    # Find best
    best = max(results, key=lambda x: x['test_accuracy'])
    print(f"\n🏆 Best: {best['name']} with {best['test_accuracy']*100:.1f}% accuracy")


if __name__ == "__main__":
    main()

