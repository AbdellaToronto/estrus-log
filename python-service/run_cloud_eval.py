#!/usr/bin/env python3
"""
Run evaluation entirely on Modal cloud.

Usage:
    python3 run_cloud_eval.py
"""

import os
from pathlib import Path


def load_dataset(base_dir: str, split_dir: str):
    """Load images and labels from dataset directory."""
    images = []
    
    split_path = Path(base_dir) / split_dir
    raw_path = Path(base_dir).parent / "dataset_raw"
    
    for label_dir in split_path.iterdir():
        if not label_dir.is_dir():
            continue
        
        label = label_dir.name.upper()
        if label == "UNKNOWN":
            continue
        
        for img_file in label_dir.glob("*.jpg"):
            # Load from raw (uncropped) directory
            raw_file = raw_path / label / img_file.name
            if raw_file.exists():
                with open(raw_file, "rb") as f:
                    img_bytes = f.read()
                images.append((img_bytes, label))
            else:
                # Fall back to split directory
                with open(img_file, "rb") as f:
                    img_bytes = f.read()
                images.append((img_bytes, label))
    
    return images


def main():
    import modal
    
    print("=" * 60)
    print("Cloud Evaluation with SAM3 + BioCLIP")
    print("=" * 60)
    
    # Load datasets
    base_dir = "../dataset_split_cropped"
    
    print("\n📂 Loading training data...")
    train_data = load_dataset(base_dir, "train")
    print(f"   Loaded {len(train_data)} training images")
    
    print("\n📂 Loading test data...")
    test_data = load_dataset(base_dir, "test")
    print(f"   Loaded {len(test_data)} test images")
    
    # Show label distribution
    from collections import Counter
    train_labels = Counter(label for _, label in train_data)
    test_labels = Counter(label for _, label in test_data)
    
    print("\n📊 Training distribution:")
    for label, count in sorted(train_labels.items()):
        print(f"   {label}: {count}")
    
    print("\n📊 Test distribution:")
    for label, count in sorted(test_labels.items()):
        print(f"   {label}: {count}")
    
    # Import the Modal function
    print("\n🚀 Starting cloud evaluation...")
    print("   (This will run SAM3 + BioCLIP + classifier entirely on Modal)")
    
    # Get the function from the deployed app
    run_evaluation = modal.Function.from_name("estrus-pipeline", "run_evaluation")
    
    # Run evaluation
    result = run_evaluation.remote(
        train_images=train_data,
        test_images=test_data,
        prompt="mouse body",
    )
    
    # Print results
    print("\n" + "=" * 60)
    print("FINAL RESULTS")
    print("=" * 60)
    print(f"🎯 Test Accuracy: {result['accuracy']:.4f} ({result['accuracy']*100:.1f}%)")
    print(f"   Train Accuracy: {result['train_accuracy']:.4f}")
    print(f"   Train samples: {result['n_train']}")
    print(f"   Test samples: {result['n_test']}")
    
    print("\n📊 Per-class metrics:")
    report = result['classification_report']
    for label in ['DIESTRUS', 'ESTRUS', 'METESTRUS', 'PROESTRUS']:
        if label.lower() in report:
            metrics = report[label.lower()]
            print(f"   {label}: precision={metrics['precision']:.2f}, recall={metrics['recall']:.2f}, f1={metrics['f1-score']:.2f}")
    
    # Compare to baselines
    print("\n📈 Comparison to baselines:")
    print(f"   k-NN (no crop):     42.2%")
    print(f"   OWLv2 + k-NN:       53.3%")
    print(f"   SAM3 + Linear:      {result['accuracy']*100:.1f}%")
    
    improvement = (result['accuracy'] - 0.533) / 0.533 * 100
    print(f"\n   Improvement over OWLv2: {improvement:+.1f}%")


if __name__ == "__main__":
    main()

