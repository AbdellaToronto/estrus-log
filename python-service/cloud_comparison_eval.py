#!/usr/bin/env python3
"""
Cloud-based comparison of cropping methods.
Runs SAM3 + BioCLIP on Modal, tests both k-NN and Linear classifiers.
"""

import os
import base64
from pathlib import Path
from collections import Counter
import modal


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
                with open(raw_file, "rb") as f:
                    images.append((f.read(), label))
            else:
                with open(img_file, "rb") as f:
                    images.append((f.read(), label))
    
    return images


def main():
    print("=" * 60)
    print("Cloud-Based Cropping Comparison")
    print("SAM3 + BioCLIP on Modal")
    print("=" * 60)
    
    # Load data
    base_dir = "../dataset_split_cropped"
    
    print("\n📂 Loading data...")
    train_data = load_dataset(base_dir, "train")
    test_data = load_dataset(base_dir, "test")
    
    print(f"   Train: {len(train_data)} images")
    print(f"   Test: {len(test_data)} images")
    
    train_dist = Counter(label for _, label in train_data)
    test_dist = Counter(label for _, label in test_data)
    print(f"   Train: {dict(train_dist)}")
    print(f"   Test: {dict(test_dist)}")
    
    # Get the cloud evaluation function
    run_comparison = modal.Function.from_name("estrus-pipeline", "run_comparison_eval")
    
    print("\n🚀 Running cloud evaluation...")
    print("   This runs entirely on Modal (SAM3 + BioCLIP + classifiers)")
    
    result = run_comparison.remote(
        train_images=train_data,
        test_images=test_data,
    )
    
    # Print results
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    
    for method_name, metrics in result.items():
        print(f"\n📊 {method_name}:")
        print(f"   k-NN Accuracy:    {metrics['knn_accuracy']*100:.1f}%")
        print(f"   Linear Accuracy:  {metrics['linear_accuracy']*100:.1f}%")
    
    print("\n" + "=" * 60)
    print("COMPARISON TO BASELINES")
    print("=" * 60)
    print("   Previous k-NN (no crop):  42.2%")
    print("   Previous OWLv2 + k-NN:    53.3%")


if __name__ == "__main__":
    main()

